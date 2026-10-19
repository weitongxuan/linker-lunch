import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import type { Config, Market, Parking } from '@lunch-map/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 不管是跑 src/lib/seedDatabase.ts(tsx)還是編譯後的 dist/lib/seedDatabase.js,
// 這個檔案都在 apps/api/{src|dist}/lib/ 底下,往上兩層一樣會到 apps/api/,
// 所以同一個相對路徑在兩種情況下都找得到同一份 JSON。
const SEED_DATA_FILE = path.resolve(__dirname, '../../prisma/seed-data.json');

/** 只有公司設定、停車場、行情。餐廳/飲料店/菜單在 data/places.json,由 importPlaces 依 id 更新,不在這裡清空重灌 */
interface SeedData {
  config: Config;
  parkings: Parking[];
  market: Market;
}

/**
 * 從 prisma/seed-data.json 灌設定/停車場/行情進資料庫(店家另外走 importPlaces)。`ifEmpty: true` 時,如果 Config 已經有資料就整個略過——
 * 用來讓容器開機時安全地自動 seed,不會每次重啟都重複清空重灌。
 */
export async function seedDatabase(prisma: PrismaClient, opts: { ifEmpty?: boolean } = {}): Promise<'seeded' | 'skipped'> {
  if (opts.ifEmpty) {
    const existing = await prisma.config.count();
    if (existing > 0) return 'skipped';
  }

  const data: SeedData = JSON.parse(fs.readFileSync(SEED_DATA_FILE, 'utf8'));

  await prisma.$transaction([prisma.parking.deleteMany(), prisma.market.deleteMany()]);

  const configFields = {
    officeLat: data.config.office.lat,
    officeLng: data.config.office.lng,
    officeName: data.config.office.name,
    departStart: data.config.depart.start,
    departEnd: data.config.depart.end,
    backBy: data.config.backBy,
    eatMinutes: data.config.eatMinutes,
    priceBands: JSON.stringify(data.config.priceBands),
    walkSpeed: data.config.walkSpeed,
    detour: data.config.detour,
    maxWalkMin: data.config.maxWalkMin,
    driveSpeed: data.config.driveSpeed,
    parkSearch: data.config.parkSearch,
    streetSearch: data.config.streetSearch,
    driveWorthIt: data.config.driveWorthIt,
    maxDriveMin: data.config.maxDriveMin,
    maxDrinkDriveMin: data.config.maxDrinkDriveMin,
  };
  await prisma.config.upsert({
    where: { id: 1 },
    update: configFields,
    create: { id: 1, ...configFields },
  });

  for (const parking of data.parkings) {
    await prisma.parking.create({ data: parking });
  }
  await prisma.market.create({
    data: {
      date: data.market.date,
      indexName: data.market.index,
      close: data.market.close,
      pct: data.market.pct,
      src: data.market.src,
    },
  });

  return 'seeded';
}
