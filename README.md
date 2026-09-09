# 午餐地圖

蓬萊路午餐地圖,前後端分離版。原本的單檔 Claude Artifact(`legacy/index.html`)已經拆成:

- `packages/shared` — TypeScript,前後端共用的型別與純函式(可行性判斷、交通時間、行情加權隨機推薦、OSM 時段解析)
- `apps/api` — Node.js + Express + Prisma(SQLite)後端
- `apps/web` — React + Vite 前端
- `deploy/docker`、`deploy/helm/lunch-map` — Docker 映像與 k8s Helm chart

## 本機開發

```bash
npm install

# 1. 準備後端
cp apps/api/.env.example apps/api/.env
npm run build -w packages/shared
npm run prisma:migrate -w apps/api      # 建資料庫 + 套用 migration
npm run seed                            # 從 apps/api/prisma/seed-data.json 匯入店家/停車場/行情資料

# 2. 兩個 dev server(各開一個終端機)
npm run dev:api      # http://localhost:4000
npm run dev:web       # http://localhost:5173(proxy /api、/photos 到 4000)
```

`npm run seed` 只需要跑一次(之後店家資料就在 SQLite 裡了);重跑也安全,它會先清空 `Shop`/`AfterPlace`/`Parking`/`Market` 表再重新灌入,不會動到評分/照片等共用資料。

`apps/api/prisma/seed-data.json` 是從 `legacy/index.html` 一次性挖出來的快照,跟著 image 一起發布,容器執行期不再需要 `legacy/index.html`。要重新從舊檔案挖資料的話:`npm run extract-legacy-data -w apps/api`。

## 測試

```bash
npm test -w packages/shared   # feasibility/travel/randomPick/osmHours 的單元測試
```

## Docker(本機用 docker-compose 驗證)

```bash
docker compose up -d --build
# web: http://localhost:8080   api: http://localhost:4000
```

API 容器開機時會自動跑 `prisma migrate deploy`,然後在資料庫是空的情況下自動 seed(已經有資料就略過,不會重複清空重灌)——`docker compose up` 完就能直接用,不用手動再跑一次 seed。

## 部署到 k8s(Helm)

```bash
docker build -f deploy/docker/api.Dockerfile -t <你的 registry>/lunch-map-api:1.0.0 .
docker build -f deploy/docker/web.Dockerfile -t <你的 registry>/lunch-map-web:1.0.0 .
docker push <你的 registry>/lunch-map-api:1.0.0
docker push <你的 registry>/lunch-map-web:1.0.0

helm install lunch-map deploy/helm/lunch-map \
  --set api.image.repository=<你的 registry>/lunch-map-api \
  --set api.image.tag=1.0.0 \
  --set web.image.repository=<你的 registry>/lunch-map-web \
  --set web.image.tag=1.0.0 \
  --set ingress.enabled=true \
  --set ingress.host=lunch-map.your-domain.com
```

**已知取捨**:資料庫是 SQLite(檔案存在 PVC 上),所以 `api` deployment 固定 1 個 replica、用 `Recreate` 策略——這對一個公司內部午餐推薦工具來說很夠用,但代表 API 沒辦法水平擴充。真的需要高可用的話,要換成 Postgres(改 `apps/api/prisma/schema.prisma` 的 `datasource.provider` 跟接一個外部資料庫)。

首次部署一樣會自動 migrate + seed(邏輯跟 docker-compose 那邊相同),不用額外手動操作。之後要更新店家資料,可以用 `POST /api/shops/import/osm`、`POST /api/parkings/import/osm` 兩個管理端點從 OpenStreetMap 現抓,或 `kubectl exec` 進 pod 跑 `npm run seed`(會清空重灌 `Shop`/`AfterPlace`/`Parking`/`Market`,不影響評分/照片)。

## 環境變數(`apps/api`)

| 變數 | 說明 |
|---|---|
| `DATABASE_URL` | SQLite 檔案路徑,例如 `file:/app/apps/api/data/lunch.db` |
| `PHOTOS_DIR` | 菜單照片存放目錄 |
| `PORT` | 預設 4000 |
| `CORS_ORIGIN` | 留空 = 放行所有來源 |
| `MARKET_CRON_ENABLED` | 是否每個交易日自動抓台股加權指數(取代原本的 `market.py`) |
