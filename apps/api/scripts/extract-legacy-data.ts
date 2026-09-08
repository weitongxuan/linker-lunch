/**
 * 一次性工具:從 legacy/index.html 挖出 window.LUNCH_DATA / window.MARKET,
 * 寫成 apps/api/prisma/seed-data.json —— 之後 seeding 都讀這個 JSON,
 * 不再依賴 legacy/index.html(那個檔案不會、也不需要跟著容器一起發布)。
 *
 * 用法(只需要跑一次,除非要重新從舊檔案挖資料): npx tsx scripts/extract-legacy-data.ts
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AfterPlace, Config, Market, Parking, Shop } from '@lunch-map/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LEGACY_HTML = path.resolve(__dirname, '../../../legacy/index.html');
const OUT_FILE = path.resolve(__dirname, '../prisma/seed-data.json');

/**
 * 從原始碼裡挖出 `<marker> = { ... };` 這段物件字面量的原始文字(不做 JSON.parse,
 * 因為原始資料是 JS 物件字面量,鍵沒有加引號、也可能有註解)。用括號計數找到對應的結尾大括號,
 * 比正規表示式更不容易被裡面的巢狀結構騙到。
 */
function extractObjectLiteral(source: string, marker: string): string {
  const markerIdx = source.indexOf(marker);
  if (markerIdx === -1) throw new Error(`找不到 ${marker}`);
  const braceStart = source.indexOf('{', markerIdx);
  if (braceStart === -1) throw new Error(`${marker} 後面沒有找到 {`);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) return source.slice(braceStart, i + 1);
    }
  }
  throw new Error(`${marker} 的大括號沒有配對完整`);
}

function evalObjectLiteral<T>(literal: string): T {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- 這是我們自己寫的、信任的內容,不是外部輸入
  return new Function(`return (${literal});`)() as T;
}

const html = fs.readFileSync(LEGACY_HTML, 'utf8');

const market = evalObjectLiteral<Market>(extractObjectLiteral(html, 'window.MARKET'));
const data = evalObjectLiteral<{
  config: Config;
  shops: Shop[];
  desserts: AfterPlace[];
  drinks: AfterPlace[];
  parkings: Parking[];
}>(extractObjectLiteral(html, 'window.LUNCH_DATA'));

fs.writeFileSync(OUT_FILE, JSON.stringify({ ...data, market }, null, 1));
console.log(
  `寫入 ${OUT_FILE}:${data.shops.length} 家店、${data.drinks.length} 個飲料、` +
    `${data.desserts.length} 個甜點、${data.parkings.length} 個停車場`,
);
