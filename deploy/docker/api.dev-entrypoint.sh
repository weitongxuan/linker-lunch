#!/bin/sh
set -e

# packages/shared 沒有 nested node_modules,dist 是純 JS,直接寫回 bind-mount 的
# host 目錄即可讓 web container 那邊也立刻看到 —— 不用另外開一個 service。
npx tsc -p packages/shared/tsconfig.json --watch --preserveWatchOutput &

npx prisma generate --schema apps/api/prisma/schema.prisma
npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
npx tsx apps/api/src/scripts/seed.ts --if-empty

exec npm run dev -w apps/api
