"""把子代理抓的菜單結果(menu-results-*.json)整理成提案檔,格式跟 apply-review.py 相同。

用法:
  python3 tools/menu-review.py <results-glob>... --out tools/nightly-review/2026-09-26-menu
  之後:python3 tools/apply-review.py tools/nightly-review/2026-09-26-menu.json --approve all

結果檔每筆:{id,name,found,source,sourceDate,sourceNote,menu,uncertain,notes}
"""
import argparse, datetime as dt, glob, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'apps/api/prisma/seed-data.json'
MAX_MENU_CHARS = 4000
PRICE_LINE = re.compile(r'\s(\d{1,4}(?:/\d{1,4})?|時價)\s*$')


def clean_menu(text):
    """統一格式:去頭尾空白、空行;只去掉「同一分類內」的重複行 ——
    冷飲、熱飲都有「紅茶牛奶 30」是兩個不同品項,不能當重複刪掉"""
    out, seen, section = [], set(), None
    for raw in (text or '').splitlines():
        line = re.sub(r'\s+', ' ', raw.strip())
        if not line:
            continue
        if line.startswith('【'):
            section = line
        key = (section, line)
        if key in seen:
            continue
        seen.add(key)
        out.append(line)
    return '\n'.join(out)[:MAX_MENU_CHARS]


def menu_stats(text):
    lines = [l for l in text.splitlines() if l and not l.startswith('【')]
    priced = sum(1 for l in lines if PRICE_LINE.search(l))
    return len(lines), priced


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--out', required=True)
    args = ap.parse_args()

    results = []
    for pat in args.inputs:
        for f in sorted(glob.glob(pat)):
            results += json.loads(pathlib.Path(f).read_text(encoding='utf-8'))
    d = json.loads(SEED.read_text(encoding='utf-8'))
    shops = {s['id']: s for s in d['shops']}
    existing = d.get('menus', {})
    today = dt.date.today().isoformat()
    report = {'date': today, 'checked': [], 'proposals': [], 'unmatched': [], 'errors': [], 'nomenu': []}
    seen = set()

    for r in results:
        sid = r.get('id')
        if sid in seen or sid not in shops:
            continue
        seen.add(sid)
        s = shops[sid]
        report['checked'].append(sid)
        if r.get('found') == 'no' or not (r.get('menu') or '').strip():
            report['nomenu'].append({'id': sid, 'name': s['name'], 'notes': r.get('notes', '')})
            continue
        menu = clean_menu(r['menu'])
        n, priced = menu_stats(menu)
        if n == 0:
            report['nomenu'].append({'id': sid, 'name': s['name'], 'notes': '讀到的內容沒有任何品項'})
            continue
        unc = [u for u in (r.get('uncertain') or []) if u]
        conf = 'check' if (r.get('found') == 'partial' or unc or priced < n * 0.6) else 'high'
        src = f"{r.get('source', '')} {r.get('sourceDate', '')} {r.get('sourceNote', '')}".strip()
        report['proposals'].append({
            'id': sid, 'type': 'shop', 'name': s['name'], 'field': 'menu',
            'current': existing.get(sid), 'proposed': menu, 'confidence': conf,
            'evidence': src + (f" / 不確定:{';'.join(unc)}" if unc else '') + (f" / {r['notes']}" if r.get('notes') else ''),
            'items': n, 'priced': priced, 'approve': None,
        })

    out = pathlib.Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.with_suffix('.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
    out.with_suffix('.md').write_text(render_md(report), encoding='utf-8')
    hi = sum(1 for p in report['proposals'] if p['confidence'] == 'high')
    print(f"查了 {len(report['checked'])} 家:抓到菜單 {len(report['proposals'])} 家(清楚 {hi}、要看一眼 {len(report['proposals']) - hi}),沒有菜單 {len(report['nomenu'])} 家")
    print('→', out.with_suffix('.md'))
    return 0


def render_md(r):
    L = [f"# 菜單核對 {r['date']}", '',
         f"查了 {len(r['checked'])} 家:抓到 {len(r['proposals'])} 家,沒有菜單 {len(r['nomenu'])} 家。",
         '`high` = 照片清楚、每項都有價格;`check` = 有字看不清楚或只讀到一部分,備註寫了哪裡不確定。', '',
         '套用:`python3 tools/apply-review.py <此檔>.json --approve all`(或 `--approve f03,f10`)', '']
    for title, conf in (('要看一眼', 'check'), ('清楚的', 'high')):
        items = [p for p in r['proposals'] if p['confidence'] == conf]
        if not items:
            continue
        L += ['', f'## {title}({len(items)} 家)', '']
        for p in items:
            L += [f"### {p['id']} {p['name']} — {p['items']} 項,{p['priced']} 項有價格", f"<sub>{p['evidence']}</sub>", '', '```', p['proposed'], '```', '']
    if r['nomenu']:
        L += ['', f"## 沒有菜單({len(r['nomenu'])} 家)", ''] + [f"- {u['id']} {u['name']}{(':' + u['notes']) if u.get('notes') else ''}" for u in r['nomenu']]
    return '\n'.join(L) + '\n'


if __name__ == '__main__':
    sys.exit(main())
