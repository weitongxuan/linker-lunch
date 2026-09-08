import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { isPlaceType } from '../lib/placeType.js';

export const reportsRouter = Router();

/** 批次讀取:某個 placeType 底下所有「未結案」回報,依 placeId 分組(卡片上的 🚩 標籤用) */
reportsRouter.get('/', async (req, res) => {
  const placeType = typeof req.query.placeType === 'string' && isPlaceType(req.query.placeType) ? req.query.placeType : undefined;
  const rows = await prisma.report.findMany({ where: { done: false, ...(placeType ? { placeType } : {}) }, orderBy: { createdAt: 'desc' } });
  const grouped: Record<string, typeof rows> = {};
  for (const r of rows) (grouped[r.placeId] ??= []).push(r);
  res.json(grouped);
});

/** 給「🚩 回報清單」modal 用:跨 shop/drink/dessert 撈全部未結案回報 */
reportsRouter.get('/open', async (_req, res) => {
  const rows = await prisma.report.findMany({ where: { done: false }, orderBy: { createdAt: 'desc' } });
  res.json(rows);
});

reportsRouter.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const done = req.body.done !== undefined ? !!req.body.done : undefined;
  const existing = await prisma.report.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  const row = await prisma.report.update({ where: { id }, data: { done: done ?? !existing.done } });
  res.json(row);
});
