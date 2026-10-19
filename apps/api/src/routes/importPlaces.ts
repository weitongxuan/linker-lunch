import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { importPlaces, type PlacesData } from '../lib/importPlaces.js';

/**
 * POST /api/import/places  body = data/places.json 的內容
 * 把核對過的餐廳/飲料店/菜單依 id 寫進線上資料庫(tools/push-places.py 會打這支)。
 * ?prune=0 → 只新增/更新,不刪檔案裡沒有的店。
 */
export const importRouter = Router();

importRouter.post('/places', async (req, res) => {
  const body = (req.body ?? {}) as PlacesData;
  const ok = (v: unknown) => v === undefined || Array.isArray(v);
  if (!ok(body.shops) || !ok(body.drinks) || (body.menus !== undefined && typeof body.menus !== 'object')) {
    res.status(400).json({ error: 'body 要長得像 data/places.json:{ shops: [], drinks: [], menus: {} }' });
    return;
  }
  if (!body.shops?.length && !body.drinks?.length) {
    // 空檔案 + prune 會把整個店家表清光,擋下來
    res.status(400).json({ error: '檔案裡沒有任何店家,不匯入' });
    return;
  }
  const prune = req.query.prune !== '0';
  const result = await importPlaces(prisma, body, { prune });
  res.json({ ok: true, prune, ...result });
});
