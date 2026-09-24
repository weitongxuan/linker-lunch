"""把夜間核對的提案套進 seed-data.json(菜單則打 API 寫進 DB)。

用法:
  python3 tools/apply-review.py tools/nightly-review/2026-09-25.json --approve all
  python3 tools/apply-review.py <json> --approve f03,d01          # 只套這幾家
  python3 tools/apply-review.py <json> --field googleRating,hours  # 只套這些欄位
  python3 tools/apply-review.py <json>                             # 只套 JSON 裡 "approve": true 的

套完會跑 tools/check-data.py;seed 有改就要 `npm run seed:dev -w apps/api`。
"""
import argparse, datetime as dt, json, pathlib, subprocess, sys, urllib.error, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'apps/api/prisma/seed-data.json'
API = 'http://localhost:4000'
SKIP_FIELDS = {'businessStatus'}  # 歇業只提醒,刪店由人決定


def put_menu(ptype, pid, text):
    req = urllib.request.Request(f'{API}/api/places/{ptype}/{pid}/menu', data=json.dumps({'text': text}).encode(),
                                 headers={'Content-Type': 'application/json'}, method='PUT')
    with urllib.request.urlopen(req, timeout=10) as r:
        return r.status


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('review')
    ap.add_argument('--approve', help='all 或 逗號分隔的 id')
    ap.add_argument('--field', help='逗號分隔欄位,只套這些')
    args = ap.parse_args()

    review = json.loads(pathlib.Path(args.review).read_text(encoding='utf-8'))
    ids = None if args.approve in (None, 'all') else set(args.approve.split(','))
    fields = set(args.field.split(',')) if args.field else None
    d = json.loads(SEED.read_text(encoding='utf-8'))
    index = {('shop', s['id']): s for s in d['shops']}
    index.update({('drink', s['id']): s for s in d['drinks']})
    today = dt.date.today().isoformat()
    applied, skipped, seed_changed = [], [], False

    for p in review['proposals']:
        ok = (args.approve is not None and (ids is None or p['id'] in ids)) or p.get('approve') is True
        if not ok or (fields and p['field'] not in fields) or p['field'] in SKIP_FIELDS:
            continue
        s = index.get((p['type'], p['id']))
        if not s:
            skipped.append(f"{p['id']} 不在 seed 裡")
            continue
        f, v = p['field'], p['proposed']
        if f == 'menu':
            try:
                put_menu(p['type'], p['id'], v)
                applied.append(f"{p['id']} menu → API")
            except (urllib.error.URLError, OSError) as e:
                skipped.append(f"{p['id']} menu:API 沒開({e})")
            continue
        if f == 'googleRating':
            s['googleRating'], s['googleReviews'] = v['googleRating'], v['googleReviews']
        elif f == 'hours':
            s['hours'] = v
            s['hoursUnknown'] = False
            s['needsReview'] = False
            s['hoursSource'] = f'Google Places API({today} 查)'
        elif f in ('addr', 'phone', 'price'):
            s[f] = v
        elif f == 'coords':
            s['lat'], s['lng'] = v['lat'], v['lng']
        else:
            skipped.append(f"{p['id']} 不認得欄位 {f}")
            continue
        seed_changed = True
        applied.append(f"{p['id']} {f}")

    if seed_changed:
        SEED.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('套用:', len(applied)); [print('  ', a) for a in applied]
    if skipped:
        print('略過:'); [print('  ', s) for s in skipped]
    if seed_changed:
        print('--- check-data ---')
        subprocess.run([sys.executable, str(ROOT / 'tools/check-data.py')])
        print('seed 有改:記得 npm run seed:dev -w apps/api')
    return 0


if __name__ == '__main__':
    sys.exit(main())
