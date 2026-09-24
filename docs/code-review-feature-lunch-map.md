# Code Review：`feature/lunch-map`（對比 `main`）

日期：2026-09-24
範圍：`git diff main...feature/lunch-map`（50 個檔案、約 124 個 commit）

## 摘要

這個 branch 把應用程式從陽春的地圖／清單畫面,做成了一個「獵人執照」風格的
午餐選擇工具:自然語言的問問看查詢框、餐廳／飲料分頁、「定位我的位置」功能、
整套視覺重新設計,以及大幅擴充並人工核實過的店家資料。以下 review 只針對
程式碼變更(不含 seed data 內容本身)。

共 12 項發現,依嚴重度排序:6 個正確性 bug,接著 6 項重複／可簡化的地方。

---

## 正確性問題

### 1. 新增店家表單的預設座標用了 GPS 位置,而不是公司座標
**apps/web/src/components/AddShopModal.tsx:53**

當「用我的位置」開啟時,`App.tsx` 會把 `config.office` 覆寫成使用者目前的
GPS 座標,而 `AddShopModal` 又拿同一個 `config` 物件來預填新店家的預設
lat/lng。

> 使用者開啟「用我的位置」(例如人在外面吃飯的時候),接著點 ➕ 新增店家
> 想登錄一間他知道、但在別處的店。lat/lng 欄位會悄悄預設成使用者當下的
> 個人位置,而不是公司座標。如果沒有在存檔前手動改掉,這間店就會被存成
> 錯誤的座標。

### 2. `useVoteMutation` 沒有 `onError`,跟 `useRateMutation` 不一致
**apps/web/src/hooks/useMutations.ts:30**

`useVoteMutation` 少了緊接在它上面的 `useRateMutation` 有的 `onError`
處理,導致投票失敗的請求會被默默吞掉。

> 後端現在會擋掉超出 0–99(`MAX_VOTE`)範圍的投票數值,回傳 HTTP 400
> (`apps/api/src/routes/places.ts:152-154`)。使用者對一間已經 99 票的店
> 點「+1」就會觸發這個 400;因為沒有 `onError`,畫面上沒有任何 toast、
> 沒有重新整理資料——按鈕就像沒反應一樣。

### 3. `POST /shops` 沒有依 `hoursUnknown` 決定 `needsReview`
**apps/api/src/routes/shops.ts:49**

POST 這支 handler 把 `needsReview` 寫死成 `false`,但同一個 branch 裡改過
的 PUT handler(第 97 行)已經改成 `needsReview: hoursUnknown`,就是為了
修掉一個「badge 沒更新」的 bug(commit `58d85a2`)。

> 用 `hoursUnknown: true`(還不知道營業時間)新增一間店。建立出來的資料
> 會是 `needsReview: false`,所以「待確認」badge 不會出現,要等之後有人
> 用 PUT 編輯過這間店才會補上——等於是把這個 branch 自己宣稱修好的 bug
> 又生出來一次。

### 4. 匯入/驗證腳本寫死了某位開發者自己電腦上的絕對路徑
**tools/import-shops.py:11**、**tools/verify-coords.py:3**

兩支腳本都寫死 `ROOT = pathlib.Path('/Users/momo/code/linker-lunch')`,
沒有像同一批新增的 `tools/check-data.py` 一樣用 `__file__` 去推導路徑。

> 只要不是在那台機器上執行——包括這個 repo 目前 checkout 在
> `/Users/simonwei/Documents/project/lunch`——執行
> `python3 tools/import-shops.py` 或 `verify-coords.py` 就會馬上失敗,
> 因為它想讀的 `seed-data.json` 路徑在別人的電腦上根本不存在。

### 5. 切換交通模式後,重抽用的還是舊模式的候選清單
**apps/web/src/components/PickCard.tsx:48**

交通模式的切換按鈕在同一個事件處理裡,先 `dispatch({ type: 'SET_MODE' })`
再馬上呼叫 `onPickAgain()`;但 `dispatch` 不會在這個 closure 執行完之前
就同步更新 state,所以 `onPickAgain`(也就是 `App.tsx` 的
`handleRandomPick`)這時候用的還是切換前那個模式算出來的 `visibleRows`。

> 使用者正在看「開車」模式抽到的店,這時點了「走路」。重抽用的其實還是
> 開車模式算出來的可行清單,新抽到的店不見得真的走路到得了。特別要注意
> 的是,`App.tsx` 針對「意圖(intent)改變篩選條件」這個一模一樣的
> race condition,已經有明確的解法(`pendingPick` flag 加上等
> `visibleRows` 重新算完才抽的 effect,見 `App.tsx:68-74`),但
> `PickCard` 裡的模式切換按鈕完全繞過了這個機制。

### 6. `SET_MODE` 少做了其他 action 都會做的 `NO_INTENT` 重置
**apps/web/src/state/filtersStore.ts:127**

`SET_DAY` 和其他所有會改變篩選條件的 action 都會多 spread 一個
`...NO_INTENT`,把 `intentNote`/`intentReply` 清掉,因為使用者手動改了
篩選條件,原本解析出來的意圖就不算數了。但緊接在 `SET_DAY` 下面的
`SET_MODE` 卻漏了這一段。

> 使用者輸入「走路就到的」(意圖解析出 `mode: 'walk'`,
> `intentNote: '走路'`;PickCard 顯示「我理解為:走路…」)。接著使用者
> 點了「開車」的切換按鈕——模式的確變成 drive 了,但「我理解為:走路」
> 這行字還留在畫面上,跟目前實際選的模式互相矛盾。

---

## 重複／可簡化的地方

### 7. 第三套各自為政的分類/料理去重邏輯
**apps/web/src/App.tsx:45**

`App.tsx` 自己用 `[...new Set(...)]` 算出不重複的分類清單和料理清單,
分類沒有排序,料理則用了照 code point 排序的 `.sort()`;而
`AddShopModal.tsx` 早就算過幾乎一樣的清單,而且是用
`.localeCompare(a, 'zh-Hant')` 做正確的中文排序。

> IntentBox 候選清單、以及「不想吃某一類」排除清單裡的順序,會跟
> AddShopModal 下拉選單裡的順序不一樣,而這只是因為兩邊排序方式不同
> (一邊有做 zh-Hant 中文排序、一邊沒排序或用預設排序),沒有任何
> 功能上的理由。

### 8. `SERVICE_LABEL` 常數又被複製了第四份
**apps/web/src/components/ActiveConditions.tsx:6**

同一份三個項目的 `Service` 對照表,現在分別獨立定義在
`ActiveConditions.tsx`、`FilterDrawer.tsx`、`AddShopModal.tsx`、
`ShopCard.tsx` 四個檔案裡,而不是從共用的地方 import。

> 這四份已經開始跑掉了:`ShopCard.tsx` 那份的型別是
> `Record<string, string>`,不是 `Record<Service, string>`。之後要新增
> 一個 `Service` 值,就得記得同時改這四個檔案。

### 9. 本地的 `SetKey` 型別重複宣告了已匯出的 `SetFilterKey`
**apps/web/src/components/ActiveConditions.tsx:5**

`ActiveConditions.tsx` 自己宣告了一個本地的 `SetKey` union 型別,但這其實
跟 `filtersStore.ts` 匯出的 `SetFilterKey` 重複——而 `SetFilterKey` 正是
這個元件 dispatch 的 `TOGGLE_SET_FILTER`/`SET_SET_FILTER` 本來就在用的
型別,而且這個檔案早就已經有從 `filtersStore.js` import 東西了。

> 之後要新增一個 set-filter 欄位,就得同時改 store 裡的 `SetFilterKey`,
> 還要另外記得改這個不相關元件裡的那一份,不然兩邊型別會悄悄不一致。

### 10. 付費停車場的標籤寫死了單一廠商的名字
**apps/web/src/components/ShopCard.tsx:36、121、222**

`isDoDoHome()` 是用 `park?.kind === '嘟嘟房'` 來判斷要不要顯示「付費
停車場」badge,同一個元件裡出現了兩次,但其實 `Parking` model 已經有一個
通用的 `rate` 欄位(目前 seed data 裡是空的)本來就是設計來做這種分類的。

> 之後如果加入第二家付費停車場廠商,或是路邊計時收費格位,除非有人再加
> 一段廠商名字的字串比對到這個元件裡,不然不會顯示付費 badge——應該讓
> badge 直接吃 `Parking.rate`/`kind` 這種通用欄位來判斷。

### 11. `passScore` 的說明註解現在掛在錯的宣告上面
**packages/shared/src/sort.ts:61**

原本用來說明 `passScore` 的兩段 doc comment,現在因為中間插入了新的
`Scorable` interface,變成掛在 `Scorable`上面,讀起來像是在說明
`Scorable` 的結構,而 `passScore` 本身反而變成沒有註解。

### 12. 整數範圍檢查在兩個地方各寫了一份
**apps/api/src/routes/places.ts:74、152**

評分路由和投票路由都各自內嵌了一段「不是 [min, max] 範圍內的整數就
拒絕」的判斷,只是上下限不同,而不是共用一個小的
`isIntInRange(n, min, max)` 之類的輔助函式。

> 這不是功能上的 bug,但重複寫的判斷邏輯讓兩個限制(`1..5` 跟
> `0..MAX_VOTE`)不容易一眼比對,未來要改其中一個上下限時也容易忘記
> 同步改另一個。
