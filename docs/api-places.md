# 新增 / 修改店家資訊 API

適用範圍:餐廳(shops)、飲料店與甜點店(drinks / desserts)。

- Base URL: https://lunch-map.betoolman.com/
- 所有請求 / 回應皆為 `application/json`
- 沒有身份驗證機制 — 任何能連到這支 API 的人都可以新增/修改,請勿把服務暴露到不受信任的網路

對應的路由原始碼:[apps/api/src/routes/shops.ts](../apps/api/src/routes/shops.ts)、[apps/api/src/routes/afterPlaces.ts](../apps/api/src/routes/afterPlaces.ts)。

## 端點總覽

| 用途 | Method | Path |
| --- | --- | --- |
| 列出所有餐廳 | GET | `/api/shops` |
| 新增餐廳 | POST | `/api/shops` |
| 修改餐廳 | PUT | `/api/shops/:id` |
| 刪除餐廳 | DELETE | `/api/shops/:id` |
| 列出所有飲料店 | GET | `/api/drinks` |
| 新增飲料店 | POST | `/api/drinks` |
| 修改飲料店 | PUT | `/api/drinks/:id` |
| 刪除飲料店 | DELETE | `/api/drinks/:id` |
| 列出所有甜點店 | GET | `/api/desserts` |
| 新增甜點店 | POST | `/api/desserts` |
| 修改甜點店 | PUT | `/api/desserts/:id` |
| 刪除甜點店 | DELETE | `/api/desserts/:id` |

drinks / desserts 的欄位結構完全一樣(共用 `AfterPlace` 型別),只是分開的兩張表,用路徑區分。

## 餐廳(shops)

### 欄位

| 欄位 | 型別 | 必填(新增時) | 說明 |
| --- | --- | --- | --- |
| `name` | string | ✅ | 店名 |
| `lat` / `lng` | number | ✅ | 座標(可從 Google 地圖網址列複製經緯度) |
| `category` | string[] | ❌ | 類別,可複選;不填則預設 `["其他"]` |
| `price` | 1\|2\|3\|4\|null | ❌ | 價位區間,不在 1~4 內一律視為 `null` |
| `service` | `("dine_in"\|"takeout"\|"delivery")[]` | ❌ | 供餐方式,不填預設空陣列 |
| `hours` | WeeklyHours | ❌ | 見下方「營業時間格式」 |
| `hoursUnknown` | boolean | ❌ | `true` 表示營業時間不確定,會忽略 `hours` 內容 |
| `addr` | string | ❌ | 地址 |
| `phone` | string | ❌ | 電話 |
| `note` | string | ❌ | 備註 |

> 其餘欄位(`googleRating`、`walkMin`、`peak`、`needsReview`…)是系統/匯入用的衍生資料,這兩支端點不處理,若要改請直接動資料庫。

### 新增:`POST /api/shops`

```bash
curl -X POST http://localhost:4000/api/shops \
  -H "Content-Type: application/json" \
  -d '{
    "name": "阿明牛肉麵",
    "lat": 25.0330,
    "lng": 121.5654,
    "category": ["麵食", "小吃"],
    "price": 2,
    "service": ["dine_in", "takeout"],
    "addr": "台北市信義區松高路1號",
    "note": "牛肉麵推薦,週一公休"
  }'
```

成功回應(`201`):

```json
{
  "id": "manual-4b1e5e9a-...",
  "name": "阿明牛肉麵",
  "lat": 25.033,
  "lng": 121.5654,
  "category": ["麵食", "小吃"],
  "price": 2,
  "service": ["dine_in", "takeout"],
  "hours": { "mon": [], "tue": [], "wed": [], "thu": [], "fri": [], "sat": [], "sun": [] },
  "hoursUnknown": false,
  "addr": "台北市信義區松高路1號",
  "note": "牛肉麵推薦,週一公休",
  "needsReview": false
}
```

失敗(`400`,店名或座標缺漏/非數字):`{"error":"店名跟座標是必填的"}`

`id` 是伺服器產生的(`manual-<uuid>`),修改時要用這個 id。

### 修改:`PUT /api/shops/:id`

**只需要帶想改的欄位**,沒帶的欄位會維持原值(部分更新 / partial update),不是整包覆蓋。

```bash
# 只改備註
curl -X PUT http://localhost:4000/api/shops/manual-4b1e5e9a-... \
  -H "Content-Type: application/json" \
  -d '{ "note": "已確認,平日供餐到 14:00" }'

# 改名字 + 價位
curl -X PUT http://localhost:4000/api/shops/manual-4b1e5e9a-... \
  -H "Content-Type: application/json" \
  -d '{ "name": "阿明牛肉麵(信義店)", "price": 3 }'
```

成功回應(`200`):更新後完整的店家物件(格式同上)。

錯誤:
- 找不到該 `id` → `404 {"error":"找不到這間店"}`
- 改完的店名或座標無效 → `400 {"error":"店名跟座標是必填的"}`(例如把 `name` 傳成空字串,或 `lat`/`lng` 傳成無法轉成數字的值)

### 刪除:`DELETE /api/shops/:id`

```bash
curl -X DELETE http://localhost:4000/api/shops/manual-4b1e5e9a-...
```

成功回應(`200`):`{"ok":true}`

錯誤:找不到該 `id` → `404 {"error":"找不到這間店"}`

刪除是直接從資料庫移除,沒有回收機制,呼叫前務必跟使用者確認清楚要刪的是哪一筆。

## 飲料店 / 甜點店(drinks / desserts)

### 欄位

| 欄位 | 型別 | 必填(新增時) | 說明 |
| --- | --- | --- | --- |
| `name` | string | ✅ | 店名 |
| `lat` / `lng` | number | ✅ | 座標 |
| `kind` | string | ❌ | 種類(單選字串,如「手搖」「烘焙」),不填預設 `"其他"` |
| `price` | 1\|2\|3\|4\|null | ❌ | 同上 |
| `hours` / `hoursUnknown` | 同上 | ❌ | 同上 |
| `addr` / `phone` / `note` | string | ❌ | 同上 |

沒有 `category`、`service`,這是跟餐廳的差異。

### 新增:`POST /api/drinks`(或 `/api/desserts`)

```bash
curl -X POST http://localhost:4000/api/drinks \
  -H "Content-Type: application/json" \
  -d '{
    "name": "五十嵐 信義店",
    "lat": 25.0335,
    "lng": 121.5660,
    "kind": "手搖",
    "price": 1
  }'
```

回應同樣是 `201` + 完整物件,`id` 一樣是 `manual-<uuid>`。

### 修改:`PUT /api/drinks/:id`(或 `/api/desserts/:id`)

跟餐廳一樣是部分更新:

```bash
curl -X PUT http://localhost:4000/api/drinks/manual-xxxx \
  -H "Content-Type: application/json" \
  -d '{ "price": 2, "note": "假日常常大排長龍" }'
```

`/api/drinks/:id` 只能改到 `placeType = "drink"` 的資料,`/api/desserts/:id` 只能改 `"dessert"` 的;id 對到另一種類型會回 `404`。

### 刪除:`DELETE /api/drinks/:id`(或 `/api/desserts/:id`)

```bash
curl -X DELETE http://localhost:4000/api/drinks/manual-xxxx
```

成功回應(`200`):`{"ok":true}`。跟修改一樣有 `placeType` 限制:`/api/drinks/:id` 只能刪 `"drink"`,`/api/desserts/:id` 只能刪 `"dessert"`,型別不符或 id 不存在都回 `404 {"error":"找不到這間店"}`。

## 營業時間格式(`WeeklyHours`)

```ts
type HourRange = [開始, 結束]; // 24 小時制 "HH:MM",例如 ["11:00", "14:00"]
type WeeklyHours = {
  mon: HourRange[]; tue: HourRange[]; wed: HourRange[]; thu: HourRange[];
  fri: HourRange[]; sat: HourRange[]; sun: HourRange[];
};
```

- 一天可以有多個時段(例如午晚餐分開:`[["11:00","14:00"], ["17:00","20:30"]]`)
- 公休的那天給空陣列 `[]`
- 跨夜營業(例如 22:00–02:00)可以讓「結束」小於等於「開始」,系統算的時候會自動 +1 天
- 如果不填 `hours`,新增時預設全部為空陣列(視為公休/未知);`hoursUnknown: true` 時會強制忽略 `hours` 內容

範例(平日 11:00–14:00,假日公休):

```json
{
  "hoursUnknown": false,
  "hours": {
    "mon": [["11:00", "14:00"]],
    "tue": [["11:00", "14:00"]],
    "wed": [["11:00", "14:00"]],
    "thu": [["11:00", "14:00"]],
    "fri": [["11:00", "14:00"]],
    "sat": [],
    "sun": []
  }
}
```

## 價位對照(`price`)

實際文字對照存在 `/api/config` 回傳的 `priceBands`,目前預設為:

| `price` | 說明 |
| --- | --- |
| 1 | $100 以下 |
| 2 | $100–200 |
| 3 | $200–300 |
| 4 | $300 以上 |
| `null` | 不填/未知 |

新增或修改時如果傳了不在 `1~4` 之間的值,伺服器會自動存成 `null`,不會回錯誤。

## Agent 使用建議

1. **判斷是新增還是修改**:先呼叫對應的 `GET /api/shops`、`GET /api/drinks`、`GET /api/desserts` 看該店名是否已存在(依 `name` 模糊比對),避免重複建立同一間店。
2. **修改時只送有變動的欄位**,不要整包帶入(尤其別把讀到的 `id`、`needsReview` 等系統欄位原封不動送回去當作要更新的資料 — 端點本來就不處理這些欄位,多送也沒作用)。
3. **一定要驗證 `lat`/`lng` 是數字**且落在合理範圍(附近沒有座標書寫錯誤,例如經緯度顛倒),送出前可以先用 `Number.isFinite()` 檢查。
4. **錯誤處理**:留意 `400`(輸入格式錯誤)與 `404`(id 不存在或型別不符,例如把飲料店 id 拿去打 `/api/desserts/:id`),回覆使用者具體原因而不是整包重試。
5. **刪除前務必再次確認**:`DELETE` 沒有回收機制,執行前跟使用者複述店名 + id 確認,避免刪錯或把「修改」誤植成「刪除」。
