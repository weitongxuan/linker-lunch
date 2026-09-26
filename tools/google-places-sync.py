"""半夜跑的資料補完:用 Google Places API(官方)核對每家店,產出「提案檔」給人隔天核對。

只讀 seed-data.json,不改任何資料;所有結果寫到 tools/nightly-review/<日期>.json 與 .md,
確認後用 tools/apply-review.py 套用。

抓的東西:Google 評分/評論數、營業時段(與現有時段逐日比對)、地址、電話、價位、營業狀態(歇業?),
以及店家照片 → macOS Vision OCR → 看起來像菜單(多行「品名 價格」)就整理成菜單提案。

用法:
  python3 tools/google-places-sync.py                 # 依輪替挑 40 家(最久沒查的優先)
  python3 tools/google-places-sync.py --limit 10 --no-photos
  python3 tools/google-places-sync.py --ids f03,d01   # 指定店
  python3 tools/google-places-sync.py --type drink

需要 GOOGLE_PLACES_API_KEY(環境變數或 repo 根目錄 .env)。
"""
import argparse, datetime as dt, json, math, os, pathlib, re, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'apps/api/prisma/seed-data.json'
OUT = ROOT / 'tools/nightly-review'
OCR_BIN = ROOT / 'tools/.bin/ocr'
DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']  # Google 的 day:0=週日
FIELDS = ','.join([
    'id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount',
    'regularOpeningHours', 'websiteUri', 'priceLevel', 'photos', 'businessStatus', 'nationalPhoneNumber',
])
PRICE_LEVEL = {'PRICE_LEVEL_INEXPENSIVE': 1, 'PRICE_LEVEL_MODERATE': 2, 'PRICE_LEVEL_EXPENSIVE': 3, 'PRICE_LEVEL_VERY_EXPENSIVE': 4}
MATCH_MAX_M = 250
# 尾端 2–4 位數才算價格;前面接數字/冒號/連字號的(電話、時間、門牌)不算
PRICE_LINE = re.compile(r'(?<![\d:\-–])(?:\$|NT\$?)?\s*(\d{2,4})\s*(?:元|塊|\$)?\s*$')
NOT_MENU = re.compile(r'電話|TEL|營業|時間|地址|號|樓|路|街|Wi-?Fi|訂位|預約', re.I)
MAX_MENU_CHARS = 4000


def load_env():
    env = ROOT / '.env'
    if env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line:
                continue
            k, v = line.split('=', 1)
            os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def haversine(a_lat, a_lng, b_lat, b_lng):
    r = 6371000
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def norm_name(s):
    s = re.sub(r'[（(【\[].*?[)）】\]]', '', s or '')
    return re.sub(r'[\s\-–—·•,,。.。「」『』]', '', s).lower()


def dice(a, b):
    a, b = norm_name(a), norm_name(b)
    if not a or not b:
        return 0.0
    if a in b or b in a:
        return 1.0
    ga = {a[i:i + 2] for i in range(len(a) - 1)}
    gb = {b[i:i + 2] for i in range(len(b) - 1)}
    if not ga or not gb:
        return 0.0
    return 2 * len(ga & gb) / (len(ga) + len(gb))


class Places:
    def __init__(self, key):
        self.key = key
        self.calls = 0

    def _req(self, url, body=None, field_mask=None):
        headers = {'X-Goog-Api-Key': self.key, 'Content-Type': 'application/json'}
        if field_mask:
            headers['X-Goog-FieldMask'] = field_mask
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method='POST' if body is not None else 'GET')
        for attempt in range(4):
            try:
                self.calls += 1
                with urllib.request.urlopen(req, timeout=30) as r:
                    return json.loads(r.read().decode())
            except urllib.error.HTTPError as e:
                text = e.read().decode(errors='replace')[:400]
                if e.code == 429 or e.code >= 500:
                    time.sleep(2 * (attempt + 1))
                    continue
                raise RuntimeError(f'HTTP {e.code}: {text}')
        raise RuntimeError('rate limited / server error after retries')

    def search(self, query, lat, lng):
        body = {
            'textQuery': query, 'languageCode': 'zh-TW', 'regionCode': 'TW', 'pageSize': 5,
            'locationBias': {'circle': {'center': {'latitude': lat, 'longitude': lng}, 'radius': 400.0}},
        }
        mask = ','.join('places.' + f for f in FIELDS.split(','))
        return self._req('https://places.googleapis.com/v1/places:searchText', body, mask).get('places', [])

    def details(self, place_name):
        return self._req(f'https://places.googleapis.com/v1/{place_name}?languageCode=zh-TW&regionCode=TW', None, FIELDS)

    def photo(self, photo_name, dest):
        url = f'https://places.googleapis.com/v1/{photo_name}/media?maxWidthPx=1600&maxHeightPx=1600&key={self.key}'
        self.calls += 1
        with urllib.request.urlopen(url, timeout=60) as r:
            dest.write_bytes(r.read())


def to_weekly(opening):
    """Google regularOpeningHours.periods → 我們的 {mon:[["11:00","14:00"]],...}"""
    hours = {d: [] for d in DAYS}
    periods = (opening or {}).get('periods') or []
    for p in periods:
        o = p.get('open') or {}
        c = p.get('close')
        d = DAYS[o.get('day', 0)]
        start = f"{o.get('hour', 0):02d}:{o.get('minute', 0):02d}"
        if not c:  # 24 小時
            hours[d].append([start, '24:00'])
            continue
        end = f"{c.get('hour', 0):02d}:{c.get('minute', 0):02d}"
        if c.get('day') != o.get('day') and end == '00:00':
            end = '24:00'
        hours[d].append([start, end])
    return {d: sorted(v) for d, v in hours.items()}


def hours_differ(ours, theirs):
    diffs = []
    for d in ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']:
        a = sorted([list(x) for x in (ours.get(d) or [])])
        b = theirs.get(d) or []
        if a != b:
            diffs.append((d, a, b))
    return diffs


def ocr(paths):
    if not OCR_BIN.exists() or not paths:
        return {}
    out = subprocess.run([str(OCR_BIN)] + [str(p) for p in paths], capture_output=True, text=True, timeout=300)
    result = {}
    for line in out.stdout.splitlines():
        try:
            o = json.loads(line)
            result[o['path']] = o.get('lines', [])
        except json.JSONDecodeError:
            pass
    return result


def menu_from_lines(lines):
    """多行「品名 價格」才算菜單;回傳 (items, 命中行數)。"""
    items = []
    pending = None
    for raw in lines:
        s = raw.strip()
        if not s or NOT_MENU.search(s):
            pending = None
            continue
        m = PRICE_LINE.search(s)
        if m:
            name = s[:m.start()].strip(' :$.-—–')
            price = m.group(1)
            if name:
                items.append(f'{name} {price}')
            elif pending:
                items.append(f'{pending} {price}')
            pending = None
        else:
            pending = s if 1 < len(s) <= 20 else None
    return items, len(items)


def pick_candidates(d, args, state):
    places = []
    if args.type in ('all', 'shop'):
        places += [('shop', s) for s in d['shops']]
    if args.type in ('all', 'drink'):
        places += [('drink', s) for s in d['drinks']]
    if args.ids:
        want = set(args.ids.split(','))
        return [p for p in places if p[1]['id'] in want]
    last = state.get('lastChecked', {})

    def missing_score(s):
        return sum([s.get('googleRating') is None, bool(s.get('hoursUnknown')), not s.get('addr'), s.get('price') is None])

    places.sort(key=lambda p: (last.get(p[1]['id'], ''), -missing_score(p[1]), p[1]['id']))
    return places[:args.limit]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=40)
    ap.add_argument('--type', choices=['all', 'shop', 'drink'], default='all')
    ap.add_argument('--ids')
    ap.add_argument('--photos', type=int, default=4, help='每家最多抓幾張照片做 OCR')
    ap.add_argument('--no-photos', action='store_true')
    ap.add_argument('--out', default=str(OUT))
    args = ap.parse_args()

    load_env()
    key = os.environ.get('GOOGLE_PLACES_API_KEY')
    if not key:
        print('缺 GOOGLE_PLACES_API_KEY(放環境變數或 repo 根目錄 .env)', file=sys.stderr)
        return 2

    out_dir = pathlib.Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    state_path = out_dir / 'state.json'
    state = json.loads(state_path.read_text(encoding='utf-8')) if state_path.exists() else {'placeIds': {}, 'lastChecked': {}}
    d = json.loads(SEED.read_text(encoding='utf-8'))
    api = Places(key)
    today = dt.date.today().isoformat()
    report = {'date': today, 'checked': [], 'proposals': [], 'unmatched': [], 'errors': []}

    def propose(ptype, s, field, current, proposed, confidence, evidence):
        report['proposals'].append({
            'id': s['id'], 'type': ptype, 'name': s['name'], 'field': field,
            'current': current, 'proposed': proposed, 'confidence': confidence,
            'evidence': evidence, 'approve': None,
        })

    for ptype, s in pick_candidates(d, args, state):
        sid = s['id']
        try:
            place = None
            cached = state['placeIds'].get(sid)
            if cached:
                place = api.details(cached)
            else:
                query = f"{s['name']} {s.get('addr') or '高雄市鹽埕區'}"
                best, best_score = None, 0
                for c in api.search(query, s['lat'], s['lng']):
                    loc = c.get('location') or {}
                    dist = haversine(s['lat'], s['lng'], loc.get('latitude', 0), loc.get('longitude', 0))
                    sim = dice(s['name'], (c.get('displayName') or {}).get('text', ''))
                    if dist <= MATCH_MAX_M and sim >= 0.3 and sim - dist / 10000 > best_score:
                        best, best_score = c, sim - dist / 10000
                if not best:
                    report['unmatched'].append({'id': sid, 'name': s['name'], 'query': query})
                    state['lastChecked'][sid] = today
                    continue
                place = best
                state['placeIds'][sid] = place['name'] if 'name' in place else f"places/{place['id']}"
            report['checked'].append(sid)
            state['lastChecked'][sid] = today
            gname = (place.get('displayName') or {}).get('text', '')
            src = f'Google Places API {today}({gname})'

            status = place.get('businessStatus')
            if status and status != 'OPERATIONAL':
                propose(ptype, s, 'businessStatus', 'OPERATIONAL', status, 'high', src)

            rating, reviews = place.get('rating'), place.get('userRatingCount')
            if rating is not None and (s.get('googleRating') != rating or s.get('googleReviews') != reviews):
                propose(ptype, s, 'googleRating', {'googleRating': s.get('googleRating'), 'googleReviews': s.get('googleReviews')},
                        {'googleRating': rating, 'googleReviews': reviews}, 'high', src)

            if place.get('regularOpeningHours'):
                theirs = to_weekly(place['regularOpeningHours'])
                if any(theirs.values()):
                    if s.get('hoursUnknown') or not any((s.get('hours') or {}).values()):
                        propose(ptype, s, 'hours', None, theirs, 'high', src + ' / ' + ' | '.join(place['regularOpeningHours'].get('weekdayDescriptions', [])))
                    else:
                        diffs = hours_differ(s.get('hours') or {}, theirs)
                        if diffs:
                            propose(ptype, s, 'hours', s['hours'], theirs, 'check',
                                    src + ' / 不同的日子:' + ','.join(x[0] for x in diffs) + ' / ' + ' | '.join(place['regularOpeningHours'].get('weekdayDescriptions', [])))

            if not s.get('addr') and place.get('formattedAddress'):
                propose(ptype, s, 'addr', None, place['formattedAddress'], 'high', src)
            if ptype == 'shop' and not s.get('phone') and place.get('nationalPhoneNumber'):
                propose(ptype, s, 'phone', None, place['nationalPhoneNumber'], 'high', src)
            if s.get('price') is None and place.get('priceLevel') in PRICE_LEVEL:
                propose(ptype, s, 'price', None, PRICE_LEVEL[place['priceLevel']], 'check', src + f" priceLevel={place['priceLevel']}")
            if place.get('websiteUri'):
                report.setdefault('websites', {})[sid] = place['websiteUri']

            if not args.no_photos and place.get('photos'):
                pdir = out_dir / 'photos' / sid
                pdir.mkdir(parents=True, exist_ok=True)
                paths = []
                for i, ph in enumerate(place['photos'][:args.photos]):
                    dest = pdir / f'{i}.jpg'
                    if not dest.exists():
                        api.photo(ph['name'], dest)
                        time.sleep(0.2)
                    paths.append(dest)
                best_items, best_path = [], None
                for path, lines in ocr(paths).items():
                    items, n = menu_from_lines(lines)
                    if n >= 3 and n > len(best_items):
                        best_items, best_path = items, path
                if best_items:
                    text = '\n'.join(best_items)[:MAX_MENU_CHARS]
                    propose(ptype, s, 'menu', None, text, 'ocr', f'照片 OCR:{best_path}')
            time.sleep(0.2)
        except Exception as e:  # 一家壞掉不要拖垮整晚
            report['errors'].append({'id': sid, 'name': s['name'], 'error': str(e)})

    state_path.write_text(json.dumps(state, ensure_ascii=False, indent=1), encoding='utf-8')
    (out_dir / f'{today}.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    (out_dir / f'{today}.md').write_text(render_md(report), encoding='utf-8')
    print(f"查了 {len(report['checked'])} 家,{len(report['proposals'])} 筆提案,{len(report['unmatched'])} 家對不到,{len(report['errors'])} 個錯誤,API 呼叫 {api.calls} 次")
    print(f"→ {out_dir / (today + '.md')}")
    return 0


def render_md(r):
    lines = [f"# 夜間核對 {r['date']}", '',
             f"查了 {len(r['checked'])} 家、{len(r['proposals'])} 筆提案、{len(r['unmatched'])} 家在 Google 對不到、{len(r['errors'])} 個錯誤。",
             '套用:`python3 tools/apply-review.py tools/nightly-review/' + r['date'] + '.json --approve all`(或 `--approve f03,d01`、`--field googleRating`)', '']
    by = {}
    for p in r['proposals']:
        by.setdefault((p['id'], p['name']), []).append(p)
    for (sid, name), ps in by.items():
        lines.append(f'## {sid} {name}')
        for p in ps:
            if p['field'] == 'hours':
                cur = '未知' if p['current'] is None else json.dumps(p['current'], ensure_ascii=False)
                lines.append(f"- **時段**({p['confidence']}):{cur} → {json.dumps(p['proposed'], ensure_ascii=False)}")
            elif p['field'] == 'menu':
                lines.append(f"- **菜單(OCR,{len(p['proposed'].splitlines())} 項)**:{p['evidence']}")
                lines += ['  ```', *['  ' + l for l in p['proposed'].splitlines()[:25]], '  ```']
            else:
                lines.append(f"- **{p['field']}**({p['confidence']}):{json.dumps(p['current'], ensure_ascii=False)} → {json.dumps(p['proposed'], ensure_ascii=False)}")
            lines.append(f"  <sub>{p['evidence']}</sub>")
        lines.append('')
    if r['unmatched']:
        lines += ['## Google 對不到(店名/地址可能要修)', *[f"- {u['id']} {u['name']}(查:{u['query']})" for u in r['unmatched']], '']
    if r['errors']:
        lines += ['## 錯誤', *[f"- {e['id']} {e['name']}:{e['error']}" for e in r['errors']], '']
    return '\n'.join(lines)


if __name__ == '__main__':
    sys.exit(main())
