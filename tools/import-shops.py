"""把子代理查到的新店匯入 seed-data.json:地址轉座標、去重、範圍與行政區檢查。

用法:
  python3 tools/import-shops.py <json>...            # 餐廳
  python3 tools/import-shops.py --drinks <json>...   # 飲料店(AfterPlace 形狀,沒有 category/service)
  python3 tools/import-shops.py --max-m 3500 <json>  # 放寬距離上限(預設 2500,午餐來回的合理範圍)
"""
import json, math, pathlib, re, subprocess, sys, time, urllib.parse

UA = 'linker-lunch-map/1.0 (momoyu@linkervision.com)'
ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'apps/api/prisma/seed-data.json'
OK_DISTRICTS = ['鹽埕區', '鼓山區', '前金區', '苓雅區']
# category 與 cuisine 都是受控詞彙:問問看的槽位是從資料裡的實際值長出來的,
# 一旦混進「豬油乾麵」這種菜色描述,使用者永遠不會那樣問,那個值就是死的。
OK_CATEGORIES = {'便當', '小吃', '水餃', '海鮮', '火鍋', '牛排', '自助餐', '速食', '飯', '麵', '其他'}
OK_CUISINES = {'台式', '日式', '港式', '泰式', '韓式', '義式', '美式', '越式', '川菜', '閩菜', '中式', '西式', '素食', '印度'}
MAX_M = 2500
DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']


def street_query(addr):
    """剝掉郵遞區號、縣市、行政區、里名,只留路名與門牌主號碼。"""
    t = re.sub(r'^\d{3,5}', '', addr.strip())
    t = re.sub(r'^[一-鿿]{2,3}[市縣]', '', t)
    t = re.sub(r'^[一-鿿]{1,3}[區鄉鎮市]', '', t)
    t = re.sub(r'^[一-鿿]{1,4}里', '', t)
    m = re.search(r'([一-鿿]{1,6}?(?:[一二三四五六七八九十]路|[路街道大道])(?:[一二三四五六七八九十]段)?)\s*(\d+)', t)
    return (m.group(2), m.group(1)) if m else None


def geocode(addr):
    q = street_query(addr)
    if not q:
        return None, f'地址格式無法解析({addr[:20]})'
    no, street = q
    # urlencode 會把空白編成 +,結構化查詢吃不到,必須是 %20
    url = ('https://nominatim.openstreetmap.org/search?'
           f"street={urllib.parse.quote(no + ' ' + street)}"
           f"&city={urllib.parse.quote('高雄市')}&country=Taiwan&format=json&limit=8")
    out = subprocess.run(['/usr/bin/curl', '-s', '-m', '20', '-A', UA, url],
                         capture_output=True, text=True).stdout
    try:
        res = json.loads(out) if out.strip() else []
    except Exception as e:
        return None, f'回應無法解析({e})'
    want = next((x for x in OK_DISTRICTS if x in addr), None)
    # 一定要落在正確的行政區,否則「大公路」會對到路竹、「五福三路」會對到苓雅
    for r in res:
        if want and want not in r['display_name']:
            continue
        return (round(float(r['lat']), 6), round(float(r['lon']), 6)), r['display_name'][:55]
    return None, f"行政區對不上({res[0]['display_name'][:35] if res else '無結果'})"


def dist_m(a, b, c, d):
    R = 6371000; p = math.pi / 180
    return R * math.hypot((d - b) * p * math.cos((a + c) / 2 * p), (c - a) * p)


def norm_name(n):
    return re.sub(r'[（(].*?[)）]|[·．・\s]', '', n)


def main():
    args = sys.argv[1:]
    drinks_mode = '--drinks' in args
    max_m = MAX_M
    if '--max-m' in args:
        i = args.index('--max-m'); max_m = int(args[i + 1]); del args[i:i + 2]
    args = [a for a in args if a != '--drinks']
    data = json.loads(SEED.read_text(encoding='utf-8'))
    office = data['config']['office']
    have = {norm_name(s['name']) for s in data['shops']} | {norm_name(s['name']) for s in data['drinks']}
    target = data['drinks'] if drinks_mode else data['shops']
    prefix = 'd' if drinks_mode else 'f'
    next_id = max(int(re.sub(r'\D', '', s['id']) or 0) for s in target) + 1
    added, skipped = [], []

    for path in args:
        for r in json.loads(pathlib.Path(path).read_text(encoding='utf-8')):
            name = r['name'].strip()
            if norm_name(name) in have:
                skipped.append((name, '已收錄')); continue
            if not r.get('addr'):
                skipped.append((name, '沒有地址')); continue
            if r.get('closed'):
                skipped.append((name, '已歇業')); continue
            coord, why = geocode(r['addr'])
            time.sleep(1.1)
            if not coord:
                skipped.append((name, why)); continue
            d = dist_m(office['lat'], office['lng'], *coord)
            if d > max_m:
                skipped.append((name, f'距離 {d:.0f}m 超出範圍 {max_m}m')); continue
            cats = [c for c in (r.get('category') or []) if c in OK_CATEGORIES]
            if not cats:
                cats = ['其他']
            cuisine = r.get('cuisine') if r.get('cuisine') in OK_CUISINES else None
            hours = r.get('hours') or {k: [] for k in DAYS}
            hours = {k: hours.get(k) or [] for k in DAYS}
            unknown = not any(hours.values())
            common = {
                'id': f'{prefix}{next_id:02d}' if drinks_mode else f'{prefix}{next_id}',
                'name': name, 'lat': coord[0], 'lng': coord[1],
                'price': r.get('price'), 'hours': hours, 'addr': r['addr'],
                'note': r.get('note') or '',
                'hoursSource': f"網路查證({time.strftime('%Y-%m-%d')},{(r.get('source') or '')[:70]})",
                'googleRating': r.get('googleRating'), 'googleReviews': r.get('googleReviews'),
                'hoursUnknown': unknown,
            }
            if drinks_mode:
                # AfterPlace:沒有 category/service/cuisine,多一個 kind
                shop = {**common, 'kind': '飲料', 'phone': r.get('phone')}
            else:
                shop = {**common, 'category': cats, 'service': ['dine_in'], 'phone': None, 'cuisine': cuisine}
            if r.get('hoursRaw'):
                shop['hoursRaw'] = r['hoursRaw']
            target.append(shop); have.add(norm_name(name))
            added.append((shop['id'], name, round(d), '(時間未知)' if unknown else ''))
            next_id += 1

    SEED.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(f'新增 {len(added)} 家:')
    for i, n, d, u in added:
        print(f'  {i:<7}{n:<30}{d:>5}m {u}')
    print(f'\n略過 {len(skipped)} 家:')
    for n, w in skipped:
        print(f'  {n:<30}{w}')
    print(f'\n總計 shops={len(data["shops"])} drinks={len(data["drinks"])}')


main()
