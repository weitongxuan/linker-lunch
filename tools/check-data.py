"""資料健檢:受控詞彙、必填欄位、時段合理性、重複。改完資料跑一次。"""
import json, math, pathlib, re
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parent.parent
d = json.loads((ROOT / 'apps/api/prisma/seed-data.json').read_text(encoding='utf-8'))
OK_CAT = {'便當', '小吃', '水餃', '海鮮', '火鍋', '牛排', '自助餐', '速食', '飯', '麵', '其他'}
OK_CUI = {'台式', '日式', '港式', '泰式', '韓式', '義式', '美式', '越式', '川菜', '閩菜', '中式', '西式', '素食', '印度'}
DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
problems = []

for s in d['shops']:
    where = f"{s['id']} {s['name']}"
    bad = [c for c in s['category'] if c not in OK_CAT]
    if bad:
        problems.append(f'{where}: category 不在詞彙內 {bad}')
    if not s['category']:
        problems.append(f'{where}: 沒有 category')
    if s.get('cuisine') and s['cuisine'] not in OK_CUI:
        problems.append(f"{where}: cuisine 不在詞彙內「{s['cuisine']}」")
    for day in DAYS:
        for slot in s['hours'].get(day) or []:
            if len(slot) != 2:
                problems.append(f'{where}: {day} 時段格式錯 {slot}')
                continue
            a, b = slot
            if not re.fullmatch(r'\d{2}:\d{2}', a) or not re.fullmatch(r'\d{2}:\d{2}', b):
                problems.append(f'{where}: {day} 時間格式錯 {slot}')
                continue
            am, bm = int(a[:2]) * 60 + int(a[3:]), int(b[:2]) * 60 + int(b[3:])
            if bm <= am:
                bm += 1440  # 跨午夜
            if bm - am > 18 * 60:
                problems.append(f'{where}: {day} 連開 {(bm-am)//60} 小時,可能有誤')
    # 欄位沒設定等同 False;真正的矛盾是「標了未知卻有時段」或「有時段卻沒標」
    if bool(s.get('hoursUnknown')) and any(s['hours'].values()):
        problems.append(f'{where}: 標了 hoursUnknown 卻有營業時段')
    if not s.get('hoursUnknown') and not any(s['hours'].values()):
        problems.append(f'{where}: 沒有任何營業時段,卻沒標 hoursUnknown')
    # needsReview 是 OSM 匯入時「時段抓不到」留下的旗標,卡片上顯示「待確認」。
    # 補完時段後若沒清掉,就會像 Pizza Rock 那樣明明查證過卻一直掛著待確認。
    if bool(s.get('needsReview')) != bool(s.get('hoursUnknown')):
        problems.append(f"{where}: needsReview={s.get('needsReview')} 與 hoursUnknown={s.get('hoursUnknown')} 不一致(待確認標記過期)")

def dm(a, b, c, e):
    R = 6371000; p = math.pi / 180
    return R * math.hypot((e - b) * p * math.cos((a + c) / 2 * p), (c - a) * p)

# 同名不同分店是正常的(鴨肉珍總店/大公店),同名又同址才是重複
seen = {}
for s in d['shops']:
    k = (re.sub(r'[（(].*?[)）]|[·．・\s]', '', s['name']), s.get('addr') or s['id'])
    if k in seen:
        problems.append(f"{s['id']} {s['name']}: 與 {seen[k]} 同名同址,疑似重複")
    seen[k] = s['name']

office = d['config']['office']
for s in d['shops'] + d['drinks']:
    # 這條是抓地理編碼對到別的行政區(路竹、岡山都在 20 公里外),不是距離政策。
    # 六合路一帶是使用者指定收的,約 3.4 公里,所以門檻放 4 公里。
    if dm(office['lat'], office['lng'], s['lat'], s['lng']) > 4000:
        problems.append(f"{s['id']} {s['name']}: 距離超過 4 公里,座標可能對到別的行政區")

print(f"餐廳 {len(d['shops'])} / 飲料 {len(d['drinks'])}")
print('類別:', dict(Counter(c for s in d['shops'] for c in s['category']).most_common()))
print('菜系:', dict(Counter(s.get('cuisine') for s in d['shops'] if s.get('cuisine')).most_common()))
print(f"\n{'✓ 沒有發現問題' if not problems else f'✗ {len(problems)} 個問題:'}")
for p in problems:
    print(' ', p)
