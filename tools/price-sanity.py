"""用外送平台價格抓「店內價可能抄錯」的菜單行。外送價本身不寫進 app。

外送價通常比店內貴 10–30%,所以:
  - 店內價 > 外送價         → 可疑(多半看錯數字、或抄到大份)
  - 店內價 < 外送價 × 0.5   → 可疑(可能漏一位數、抄錯行)
  - 其餘                    → 正常

用法:python3 tools/price-sanity.py <fp-results-*.json>... --out <scratch>/price-flags.json
結果檔每筆 priceChecks: [{"ours": 我們菜單那一整行, "fp": "外送價 60 或 60/70"}]
"""
import argparse, glob, json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SEED = ROOT / 'apps/api/prisma/seed-data.json'
QTY = re.compile(r'(\d+)\s*(?:個|支|顆|粒|克|g|塊|片|條|入|串|份|碗|杯)')
MULTI = re.compile(r'一隻|半隻|[大中小]\d{2,}')
TAIL = re.compile(r'\s((?:\d{1,4}/)*\d{1,4})(?:\s*[(（][^)）]*[)）])?\s*$')


def prices(s):
    """'60/70' → [60, 70];'NT$ 85' → [85];抓不到 → []"""
    m = TAIL.search(' ' + s.strip())
    if m:
        return [int(x) for x in m.group(1).split('/')]
    return [int(x) for x in re.findall(r'\d{1,4}', s)][:3]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('inputs', nargs='+')
    ap.add_argument('--out', required=True)
    args = ap.parse_args()
    d = json.loads(SEED.read_text(encoding='utf-8'))
    names = {s['id']: s['name'] for s in d['shops'] + d['drinks']}
    flags, total = [], 0
    for pat in args.inputs:
        for f in sorted(glob.glob(pat)):
            for r in json.loads(pathlib.Path(f).read_text(encoding='utf-8')):
                lines = set(d['menus'].get(r['id'], '').splitlines())
                for pc in r.get('priceChecks') or []:
                    ours_line, fp = pc.get('ours', '').strip(), str(pc.get('fp', ''))
                    if ours_line not in lines:
                        continue
                    ours, theirs = prices(ours_line), prices(fp)
                    if not ours or not theirs:
                        continue
                    total += 1
                    # 兩邊寫的份量不同(5支 vs 1份、3顆 vs 1顆、80克)就不能比
                    q_ours, q_fp = QTY.findall(ours_line), QTY.findall(fp)
                    if (q_ours or q_fp) and sorted(q_ours) != sorted(q_fp):
                        continue
                    # 一隻/半隻/大/小 這種多段價格,外送通常只上其中一種,對不準
                    if MULTI.search(ours_line):
                        continue
                    why = []
                    if len(ours) == len(theirs):
                        for o, t in zip(ours, theirs):
                            if o > t:
                                why.append(f'店內 {o} > 外送 {t}')
                            elif o < t * 0.5:
                                why.append(f'店內 {o} < 外送 {t} 的一半')
                    else:
                        # 外送只列一個價,不知道是哪一份:最便宜的份比外送貴、或最貴的份不到外送一半,才可疑
                        t = min(theirs)
                        if min(ours) > t:
                            why.append(f'店內最便宜 {min(ours)} > 外送 {t}')
                        elif max(ours) < t * 0.5:
                            why.append(f'店內最貴 {max(ours)} < 外送 {t} 的一半')
                    if why:
                        flags.append({'id': r['id'], 'name': names.get(r['id'], ''), 'line': ours_line, 'fp': fp, 'why': ';'.join(why)})
    pathlib.Path(args.out).write_text(json.dumps(flags, ensure_ascii=False, indent=1), encoding='utf-8')
    print(f'比對 {total} 筆,可疑 {len(flags)} 筆 → {args.out}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
