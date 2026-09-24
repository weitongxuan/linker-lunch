import json, math, pathlib, re, subprocess, sys, time, urllib.parse
UA = 'linker-lunch-map/1.0 (momoyu@linkervision.com)'
ROOT = pathlib.Path('/Users/momo/code/linker-lunch')

def street_query(addr):
    t = re.sub(r'^\d{3,5}', '', addr.strip())
    t = re.sub(r'^[一-鿿]{2,3}[市縣]', '', t)
    t = re.sub(r'^[一-鿿]{1,3}[區鄉鎮市]', '', t)
    t = re.sub(r'^[一-鿿]{1,4}里', '', t)
    m = re.search(r'([一-鿿]{1,6}?(?:[一二三四五六七八九十]路|[路街道大道])(?:[一二三四五六七八九十]段)?)\s*(\d+)', t)
    return (m.group(2), m.group(1)) if m else None

def geocode(no, street):
    q = f"street={urllib.parse.quote(no + ' ' + street)}&city={urllib.parse.quote('高雄市')}&country=Taiwan&format=json&limit=5"
    out = subprocess.run(['/usr/bin/curl','-s','-m','20','-A',UA,
                          f'https://nominatim.openstreetmap.org/search?{q}'],
                         capture_output=True, text=True).stdout
    try:
        return json.loads(out) if out.strip() else []
    except Exception:
        return []

def dist_m(a, b, c, d):
    R = 6371000; p = math.pi/180
    return R * math.hypot((d-b)*p*math.cos((a+c)/2*p), (c-a)*p)

data = json.loads((ROOT/'apps/api/prisma/seed-data.json').read_text(encoding='utf-8'))
rows = [s for s in data['shops'] if s.get('addr')] + [s for s in data['drinks'] if s.get('addr')]
print(f'比對 {len(rows)} 家有地址的店\n', flush=True)
bad = []
for i, s in enumerate(rows, 1):
    q = street_query(s['addr'])
    if not q:
        continue
    want_dist = next((d for d in ['鹽埕區','鼓山區','前金區','苓雅區','新興區'] if d in s['addr']), None)
    res = [r for r in geocode(*q) if not want_dist or want_dist in r['display_name']]
    time.sleep(1.1)
    if not res:
        continue
    # 同一條路可能有多筆同號門牌(不同里),取離現有座標最近的那筆再比,
    # 否則會把正確的店誤判成錯的 —— 津茶就是這樣被誤報 1068m。
    best = min(res, key=lambda r: dist_m(s['lat'], s['lng'], float(r['lat']), float(r['lon'])))
    d = dist_m(s['lat'], s['lng'], float(best['lat']), float(best['lon']))
    res = [best]
    if d > 300:
        bad.append((s['id'], s['name'], s['addr'], round(d), float(res[0]['lat']), float(res[0]['lon']),
                    res[0]['display_name'][:50]))
        print(f"  ⚠ {s['name']:<24} 差 {d:>6.0f}m  {s['addr']}", flush=True)
    if i % 25 == 0:
        print(f'  ...{i}/{len(rows)}', flush=True)
(pathlib.Path(sys.argv[1])/'coord-mismatch.json').write_text(
    json.dumps([{'id':b[0],'name':b[1],'addr':b[2],'offBy':b[3],'geoLat':b[4],'geoLng':b[5],'geoName':b[6]} for b in bad],
               ensure_ascii=False, indent=1), encoding='utf-8')
print(f'\n座標與地址差超過 300m 的:{len(bad)} 家')
