import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '@prisma/client';
import type { AfterPlace, Shop } from '@lunch-map/shared';
import { fromAfterPlace, fromShop } from './serialize.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// apps/api/{src|dist}/lib/ → 往上四層是 repo 根目錄;docker image 裡也照 repo 的相對位置放(/app/data/places.json)
export const PLACES_FILE = path.resolve(__dirname, '../../../../data/places.json');

/** data/places.json 的形狀:核對過的餐廳、飲料店與菜單。跟 seed-data.json(設定/停車場/行情)分開放 */
export interface PlacesData {
  shops?: Shop[];
  drinks?: AfterPlace[];
  /** 店家 id → 菜單文字(一行一項,【分類】行是標題) */
  menus?: Record<string, string>;
}

export interface ImportResult {
  shops: { created: number; updated: number; removed: number };
  drinks: { created: number; updated: number; removed: number };
  menus: { written: number; removed: number };
}

export function readPlacesFile(file = PLACES_FILE): PlacesData {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PlacesData;
}

/** 在 app 裡手動新增的店 id 都是 manual-…,匯入永遠不碰這些 */
const isManual = (id: string) => id.startsWith('manual-');

/**
 * 把 places.json 依 id 寫進資料庫:有的更新、沒有的新增。
 * - 評分、照片、投票、留言完全不動(都是另外的表)
 * - manual-… 的店(同事在 app 裡加的)不動
 * - prune=true 時,檔案裡沒有、又不是 manual- 的店會被刪掉(= 核對後確認歇業的那些),連同它的菜單
 * - 菜單:檔案裡有的就覆寫;還在的店如果檔案裡沒菜單,保留 DB 現有的(可能是同事在 app 裡打的)
 * 同一份檔案重跑幾次結果都一樣,所以線上更新可以放心重複執行。
 */
export async function importPlaces(prisma: PrismaClient, data: PlacesData, opts: { prune?: boolean } = {}): Promise<ImportResult> {
  const prune = opts.prune ?? true;
  const shops = (data.shops ?? []).filter((s) => !isManual(s.id));
  const drinks = (data.drinks ?? []).filter((d) => !isManual(d.id));
  const result: ImportResult = {
    shops: { created: 0, updated: 0, removed: 0 },
    drinks: { created: 0, updated: 0, removed: 0 },
    menus: { written: 0, removed: 0 },
  };

  const existingShops = new Set((await prisma.shop.findMany({ select: { id: true } })).map((r) => r.id));
  const existingDrinks = new Set((await prisma.afterPlace.findMany({ where: { placeType: 'drink' }, select: { id: true } })).map((r) => r.id));

  const ops = [];
  for (const s of shops) {
    const row = fromShop({ ...s, note: s.note ?? '' });
    ops.push(prisma.shop.upsert({ where: { id: s.id }, update: row, create: row }));
    existingShops.has(s.id) ? result.shops.updated++ : result.shops.created++;
  }
  for (const d of drinks) {
    const row = fromAfterPlace({ ...d, note: d.note ?? '' }, 'drink');
    ops.push(prisma.afterPlace.upsert({ where: { id: d.id }, update: row, create: row }));
    existingDrinks.has(d.id) ? result.drinks.updated++ : result.drinks.created++;
  }

  const typeOf = new Map<string, 'shop' | 'drink'>([
    ...shops.map((s) => [s.id, 'shop'] as const),
    ...drinks.map((d) => [d.id, 'drink'] as const),
  ]);
  for (const [placeId, text] of Object.entries(data.menus ?? {})) {
    const placeType = typeOf.get(placeId);
    if (!placeType || !text.trim()) continue;
    ops.push(prisma.menu.upsert({ where: { placeId_placeType: { placeId, placeType } }, update: { text }, create: { placeId, placeType, text } }));
    result.menus.written++;
  }

  if (prune) {
    const goneShops = [...existingShops].filter((id) => !isManual(id) && !typeOf.has(id));
    const goneDrinks = [...existingDrinks].filter((id) => !isManual(id) && !typeOf.has(id));
    const gone = [...goneShops, ...goneDrinks];
    if (gone.length) {
      ops.push(prisma.shop.deleteMany({ where: { id: { in: goneShops } } }));
      ops.push(prisma.afterPlace.deleteMany({ where: { id: { in: goneDrinks }, placeType: 'drink' } }));
      result.menus.removed = await prisma.menu.count({ where: { placeId: { in: gone } } });
      ops.push(prisma.menu.deleteMany({ where: { placeId: { in: gone } } }));
    }
    result.shops.removed = goneShops.length;
    result.drinks.removed = goneDrinks.length;
  }

  await prisma.$transaction(ops);
  return result;
}
