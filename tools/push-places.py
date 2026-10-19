"""把 data/places.json(核對過的餐廳/飲料店/菜單)推到線上 server。

  python3 tools/push-places.py --api https://lunch.example.com   # 依 id 新增/更新,檔案裡沒有的店會刪
  python3 tools/push-places.py --api http://localhost:4000 --no-prune   # 只新增/更新,不刪
  python3 tools/push-places.py --api … --preview                 # 先讀線上現況比對,印出會新增/更新/刪哪些,不寫
  python3 tools/push-places.py --api … --dry-run                 # 只印會送什麼,不送

評分、照片、投票、留言,以及不是資料集 id 的店(app 手動加的 manual-…、OSM 匯入的 osm…)一律不碰;同一份檔案重跑幾次結果都一樣。
"""
import argparse, json, pathlib, re, sys, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLACES = ROOT / 'data/places.json'


def fetch(url):
    with urllib.request.urlopen(url, timeout=30) as r:
        return json.loads(r.read())


def preview(api, d, prune):
    """跟線上比對 id:不寫任何東西,只印出真的推上去會發生什麼"""
    try:
        online_shops = {s['id']: s['name'] for s in fetch(f'{api}/api/shops')}
        online_drinks = {s['id']: s['name'] for s in fetch(f'{api}/api/drinks')}
    except (urllib.error.URLError, OSError) as e:
        print('連不上線上 server:', e); return 1
    for label, online, local in (('餐廳', online_shops, d.get('shops', [])), ('飲料', online_drinks, d.get('drinks', []))):
        ids = {s['id'] for s in local}
        new = [s['name'] for s in local if s['id'] not in online]
        upd = [s['name'] for s in local if s['id'] in online]
        managed = lambda i: re.fullmatch(r'[fd]\d+', i) is not None
        manual = [n for i, n in online.items() if not managed(i)]
        gone = [n for i, n in online.items() if managed(i) and i not in ids]
        print(f"\n{label}:線上 {len(online)} 家 → 新增 {len(new)}、更新 {len(upd)}、{'刪除' if prune else '不刪(--no-prune)'} {len(gone)};線上手動加/OSM 匯入的 {len(manual)} 家不動")
        if new: print('  新增:', '、'.join(new[:15]) + (' …' if len(new) > 15 else ''))
        if gone: print('  ' + ('刪除' if prune else '檔案裡沒有') + ':', '、'.join(gone[:15]) + (' …' if len(gone) > 15 else ''))
        if manual: print('  線上手動加/OSM 的:', '、'.join(manual[:10]) + (' …' if len(manual) > 10 else ''))
    print('\n(以上只是比對,沒有寫入;確認沒問題再拿掉 --preview 真的推)')
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--api', required=True, help='API 根網址,例如 https://lunch.example.com(不含 /api)')
    ap.add_argument('--no-prune', action='store_true', help='不刪檔案裡沒有的店')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--preview', action='store_true', help='讀線上現況比對後印出差異,不寫')
    args = ap.parse_args()

    d = json.loads(PLACES.read_text(encoding='utf-8'))
    print(f"餐廳 {len(d.get('shops', []))} 家、飲料 {len(d.get('drinks', []))} 家、菜單 {len(d.get('menus', {}))} 份 → {args.api}")
    if args.dry_run:
        return 0
    if args.preview:
        return preview(args.api.rstrip('/'), d, prune=not args.no_prune)
    url = args.api.rstrip('/') + '/api/import/places' + ('?prune=0' if args.no_prune else '')
    req = urllib.request.Request(url, data=json.dumps(d, ensure_ascii=False).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            res = json.loads(r.read())
    except urllib.error.HTTPError as e:
        print('失敗:', e.code, e.read().decode(errors='replace')[:500]); return 1
    except (urllib.error.URLError, OSError) as e:
        print('連不上:', e); return 1
    s, k, m = res['shops'], res['drinks'], res['menus']
    print(f"完成:餐廳 +{s['created']} 更新 {s['updated']} 刪 {s['removed']};飲料 +{k['created']} 更新 {k['updated']} 刪 {k['removed']};菜單 {m['written']} 份(刪 {m['removed']})")
    return 0


if __name__ == '__main__':
    sys.exit(main())
