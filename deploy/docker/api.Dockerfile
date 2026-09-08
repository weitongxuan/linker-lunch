# 建置階段:整個 monorepo 一起裝依賴(npm workspaces 需要每個 workspace 的
# package.json 都在,才能跟 package-lock.json 對得起來),但只真的編譯 shared + api。
FROM node:24-alpine AS build
WORKDIR /app
# Alpine 沒裝 openssl 的話,Prisma 偵測不到版本,只能用預設值猜 —— 明確裝起來比較保險。
RUN apk add --no-cache openssl

COPY package.json package-lock.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w packages/shared
RUN npm run build -w apps/api

# 執行階段
FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# 用官方 node image 內建的 node 使用者(uid/gid 1000)—— k8s 那邊
# securityContext.fsGroup: 1000 要對得上,才能寫 PVC,不用自己另外建帳號。
RUN apk add --no-cache openssl

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# 保留 prisma devDependency(容器啟動時要跑 migrate deploy),不 prune —— 對內部工具來說,
# 犧牲一點 image 大小換開發簡單划算。

RUN mkdir -p /app/apps/api/data/photos && chown -R node:node /app/apps/api/data
USER node
WORKDIR /app/apps/api
EXPOSE 4000
# migrate 之後自動 seed(只有資料庫是空的才會真的寫入,已經 seed 過就直接略過)——
# 這樣 docker compose up / 第一次部署完不用再手動跑一次 seed,config/market 才不會 404。
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/scripts/seed.js --if-empty && node dist/server.js"]
