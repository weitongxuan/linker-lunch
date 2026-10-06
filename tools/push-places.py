"""把 data/places.json(核對過的餐廳/飲料店/菜單)推到線上 server。

  python3 tools/push-places.py --api https://lunch.example.com   # 依 id 新增/更新,檔案裡沒有的店會刪
  python3 tools/push-places.py --api http://localhost:4000 --no-prune   # 只新增/更新,不刪
  python3 tools/push-places.py --api … --dry-run                 # 只印會送什麼,不送

評分、照片、投票、留言,以及同事在 app 裡手動加的店(manual-…)一律不碰;同一份檔案重跑幾次結果都一樣。
"""
import argparse, json, pathlib, sys, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
PLACES = ROOT / 'data/places.json'


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--api', required=True, help='API 根網址,例如 https://lunch.example.com(不含 /api)')
    ap.add_argument('--no-prune', action='store_true', help='不刪檔案裡沒有的店')
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    d = json.loads(PLACES.read_text(encoding='utf-8'))
    print(f"餐廳 {len(d.get('shops', []))} 家、飲料 {len(d.get('drinks', []))} 家、菜單 {len(d.get('menus', {}))} 份 → {args.api}")
    if args.dry_run:
        return 0
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
