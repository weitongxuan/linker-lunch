import { PrismaClient } from '@prisma/client';
import { importPlaces, readPlacesFile } from '../lib/importPlaces.js';

/**
 * 本機/容器直接對資料庫匯入 data/places.json(線上 server 請用 tools/push-places.py 打 API)。
 *   --if-empty  資料庫已經有店家就略過(容器開機用:第一次灌一次,之後重啟不動線上資料)
 *   --no-prune  不刪檔案裡沒有的店
 */
const ifEmpty = process.argv.includes('--if-empty');
const prune = !process.argv.includes('--no-prune');
const prisma = new PrismaClient();

(async () => {
  if (ifEmpty && (await prisma.shop.count()) > 0) {
    console.log('已經有店家資料,略過匯入。');
    return;
  }
  const r = await importPlaces(prisma, readPlacesFile(), { prune });
  console.log(`餐廳 +${r.shops.created} ~${r.shops.updated} -${r.shops.removed};飲料 +${r.drinks.created} ~${r.drinks.updated} -${r.drinks.removed};菜單 ${r.menus.written} 份(刪 ${r.menus.removed})`);
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
