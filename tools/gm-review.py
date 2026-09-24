"""把「Google 地圖網頁查證」的結果(子代理產出的 gm-results-*.json)跟 seed-data.json 比對,
產出跟 google-places-sync.py 同格式的提案檔:<out>.json(給 apply-review.py 套用)+ <out>.md(給人核對)。

用法:
  python3 tools/gm-review.py <results-glob-or-files>... --out tools/nightly-review/2026-09-25-gm
  之後:python3 tools/apply-review.py tools/nightly-review/2026-09-25-gm.json --approve all

結果檔每筆:{id,type,name,googleName,matched,rating,reviews,phone,addr,lat,lng,status,hours,hoursRaw,notes}
"""
import argparse, datetime as dt, glob, json, math, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'apps/api/prisma/seed-data.json'
DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
DAY_ZH = dict(zip(DAYS, ['一', '二', '三', '四', '五', '六', '日']))
COORD_FLAG_M = 150   # 座標差超過這個就列出來


def haversine(a_lat, a_lng, b_lat, b_lng):
    r = 6371000
    p1, p2 = math.radians(a_lat), math.radians(b_lat)
    dp, dl = math.radians(b_lat - a_lat), math.radians(b_lng - a_lng)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def norm_phone(p):
    digits = re.sub(r'\D', '', p or '')
    # +886 7 532 6899 與 07 532 6899 是同一支
    if digits.startswith('886'):
        digits = '0' + digits[3:]
    return digits


def norm_addr(a):
    """郵遞區號、里名、門牌後面的附註(捷運出口、樓層)都不算差異"""
    a = re.sub(r'\s', '', a or '').replace('之', '-')
    a = re.sub(r'^\d{3,5}', '', a)
    a = re.sub(r'(?<=區)[一-鿿]{1,3}里', '', a)
    m = re.search(r'號', a)
    return a[: m.end()] if m else a


def norm_hours(h):
    """結束時間 00:00 與 24:00 是同一件事;比對用"""
    return {d: sorted([[a, '24:00' if b == '00:00' else b] for a, b in ((h or {}).get(d) or [])]) for d in DAYS}


def hours_text(h):
    parts = []
    for d in DAYS:
        v = (h or {}).get(d) or []
        parts.append(f"{DAY_ZH[d]}:" + ('休' if not v else '/'.join(f'{a}-{b}' for a, b in v)))
    return ' '.join(parts)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--out', required=True, help='輸出路徑(不含副檔名)')
    args = ap.parse_args()

    results = []
    for pat in args.inputs:
        for f in sorted(glob.glob(pat)):
            results += json.loads(pathlib.Path(f).read_text(encoding='utf-8'))
    d = json.loads(SEED.read_text(encoding='utf-8'))
    index = {('shop', s['id']): s for s in d['shops']}
    index.update({('drink', s['id']): s for s in d['drinks']})
    today = dt.date.today().isoformat()

    report = {'date': today, 'checked': [], 'proposals': [], 'unmatched': [], 'errors': [], 'unchanged': []}
    seen = set()

    def propose(ptype, s, field, current, proposed, confidence, evidence):
        report['proposals'].append({'id': s['id'], 'type': ptype, 'name': s['name'], 'field': field,
                                    'current': current, 'proposed': proposed, 'confidence': confidence,
                                    'evidence': evidence, 'approve': None})

    for r in results:
        key = (r.get('type'), r.get('id'))
        if key in seen or key not in index:
            continue
        seen.add(key)
        s = index[key]
        ptype = r['type']
        if r.get('matched') == 'no':
            report['unmatched'].append({'id': s['id'], 'name': s['name'], 'notes': r.get('notes', '')})
            continue
        report['checked'].append(s['id'])
        conf = 'high' if r.get('matched') == 'yes' else 'check'
        src = f"Google 地圖網頁 {today}({r.get('googleName') or ''}){(' — ' + r['notes']) if r.get('notes') else ''}"
        changed = False

        if r.get('status') and r['status'] != 'open':
            propose(ptype, s, 'businessStatus', 'open', r['status'], conf, src); changed = True

        if r.get('rating') is not None and (s.get('googleRating') != r['rating'] or s.get('googleReviews') != r.get('reviews')):
            # 本來就有評分、只是評論數漂移 → 小更新;本來空的 → 補上
            kind = 'refresh' if s.get('googleRating') is not None else conf
            propose(ptype, s, 'googleRating', {'googleRating': s.get('googleRating'), 'googleReviews': s.get('googleReviews')},
                    {'googleRating': r['rating'], 'googleReviews': r.get('reviews')}, kind, src); changed = True

        if ptype == 'shop' and r.get('phone') and norm_phone(r['phone']) != norm_phone(s.get('phone')):
            propose(ptype, s, 'phone', s.get('phone'), r['phone'], 'check' if s.get('phone') else conf, src); changed = True

        if r.get('addr') and norm_addr(r['addr']) != norm_addr(s.get('addr')):
            propose(ptype, s, 'addr', s.get('addr'), r['addr'], 'check' if s.get('addr') else conf, src); changed = True

        if r.get('lat') is not None and r.get('lng') is not None:
            dist = haversine(s['lat'], s['lng'], float(r['lat']), float(r['lng']))
            if dist > COORD_FLAG_M:
                propose(ptype, s, 'coords', {'lat': s['lat'], 'lng': s['lng']}, {'lat': float(r['lat']), 'lng': float(r['lng'])},
                        'check', src + f' / 距現有座標 {dist:.0f} m'); changed = True

        if r.get('hours'):
            theirs = norm_hours(r['hours'])
            ours = norm_hours(s.get('hours'))
            # 查詢那週的週五是中秋節,Google 顯示的是節日時段:我們有週五資料就保留,不拿節日時段覆蓋
            holiday_fri = any('中秋' in x for x in (r.get('hoursRaw') or []) if x.startswith('星期五')) or '中秋' in (r.get('notes') or '')
            if holiday_fri and any(ours.values()):
                theirs['fri'] = ours['fri']
            if any(theirs.values()):
                if s.get('hoursUnknown') or not any(ours.values()):
                    propose(ptype, s, 'hours', None, theirs, conf, src + ' / ' + ' | '.join(r.get('hoursRaw') or [])); changed = True
                elif ours != theirs:
                    diff_days = [DAY_ZH[dd] for dd in DAYS if ours[dd] != theirs[dd]]
                    propose(ptype, s, 'hours', s.get('hours'), theirs, 'check',
                            src + ' / 不同的日子:' + ''.join(diff_days) + ' / ' + ' | '.join(r.get('hoursRaw') or [])); changed = True
        if not changed:
            report['unchanged'].append(s['id'])

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    out.with_suffix('.md').write_text(render_md(report), encoding='utf-8')
    by_field = {}
    for p in report['proposals']:
        by_field[p['field']] = by_field.get(p['field'], 0) + 1
    print(f"比對 {len(report['checked'])} 家:{len(report['proposals'])} 筆提案 {by_field};完全一致 {len(report['unchanged'])} 家;對不到 {len(report['unmatched'])} 家")
    print('→', out.with_suffix('.md'))
    return 0


def render_md(r):
    L = [f"# Google 地圖核對 {r['date']}", '',
         f"比對 {len(r['checked'])} 家,{len(r['proposals'])} 筆提案;{len(r['unchanged'])} 家完全一致;{len(r['unmatched'])} 家對不到。",
         '`high` = 店名地址都對上;`check` = 要看一眼(對到但有疑慮、或跟現有資料不同)。', '',
         '套用:`python3 tools/apply-review.py ' + r['date'] + '-gm.json --approve all`(或 `--approve f03,d01`、`--field googleRating,phone`)', '']
    def cell(p):
        if p['field'] == 'hours':
            cur = '未知' if p['current'] is None else hours_text(p['current'])
            new = hours_text(p['proposed'])
        elif p['field'] == 'googleRating':
            cur = f"{p['current']['googleRating']} ({p['current']['googleReviews']})" if p['current']['googleRating'] is not None else '空'
            new = f"{p['proposed']['googleRating']} ({p['proposed']['googleReviews']})"
        elif p['field'] == 'coords':
            cur = f"{p['current']['lat']:.5f},{p['current']['lng']:.5f}"
            new = f"{p['proposed']['lat']:.5f},{p['proposed']['lng']:.5f}"
        else:
            cur = '空' if p['current'] in (None, '') else str(p['current'])
            new = str(p['proposed'])
        note = ''
        if ' / ' in p['evidence']:
            note = p['evidence'].split(' / ')[1]  # 只留「不同的日子」「距現有座標」那句,原始時段字串留在 json
        return cur, new, note

    def section(title, intro, items):
        nonlocal L
        if not items:
            return
        L += ['', f'## {title}({len(items)} 筆)', '', intro, '', '| 店 | 欄位 | 現在 | Google | 備註 |', '|---|---|---|---|---|']
        for p in items:
            cur, new, note = cell(p)
            L.append(f"| {p['id']} {p['name']} | {p['field']} | {cur} | {new} | {note} |")

    ps = r['proposals']
    section('要你決定', '跟現有資料不同、或對到但有疑慮的:時段、地址、座標、歇業、電話不同。',
            [p for p in ps if p['confidence'] == 'check'])
    section('補上空欄位', '我們本來沒有、Google 有;店名地址都對上。', [p for p in ps if p['confidence'] == 'high'])
    section('小更新', '評分/評論數自然漂移,照 Google 更新。', [p for p in ps if p['confidence'] == 'refresh'])
    if r['unmatched']:
        L += ['', '## Google 上對不到(可能歇業或店名/地址要修)', ''] + [f"- {u['id']} {u['name']}{(':' + u['notes']) if u.get('notes') else ''}" for u in r['unmatched']]
    if r['unchanged']:
        L += ['', f"## 完全一致({len(r['unchanged'])} 家)", '', ', '.join(r['unchanged'])]
    return '\n'.join(L) + '\n'


if __name__ == '__main__':
    sys.exit(main())
