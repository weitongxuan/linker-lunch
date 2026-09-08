import { Router } from 'express';
import { today } from '@lunch-map/shared';
import { prisma } from '../lib/prisma.js';
import { isPlaceType } from '../lib/placeType.js';

/**
 * 批次讀取端點:前端一次拿到「某個 placeType 底下所有店家」的評分/投票/臨時公休/吃過紀錄/菜單,
 * 用來一次算完 189 家店的可行性與排序,不用對每家店各打一次 API。
 * 個別店家的讀寫(詳情面板、送出評分/回報等)仍然走 /api/places/:placeType/:placeId/*。
 */

function placeTypeFilter(q: unknown): string | undefined {
  return typeof q === 'string' && isPlaceType(q) ? q : undefined;
}

export const ratingsRouter = Router();
ratingsRouter.get('/', async (req, res) => {
  const placeType = placeTypeFilter(req.query.placeType);
  const rows = await prisma.rating.findMany({ where: placeType ? { placeType } : {} });
  const grouped: Record<string, { avg: number; n: number; who: Record<string, number> }> = {};
  for (const r of rows) {
    grouped[r.placeId] ??= { avg: 0, n: 0, who: {} };
    grouped[r.placeId].who[r.personName] = r.score;
  }
  for (const g of Object.values(grouped)) {
    const vals = Object.values(g.who).filter((v) => v > 0);
    g.n = vals.length;
    g.avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  }
  res.json(grouped);
});

export const votesRouter = Router();
votesRouter.get('/', async (req, res) => {
  const placeType = placeTypeFilter(req.query.placeType);
  const rows = await prisma.vote.findMany({ where: placeType ? { placeType } : {} });
  const grouped: Record<string, { total: number; byPerson: Record<string, number> }> = {};
  for (const r of rows) {
    grouped[r.placeId] ??= { total: 0, byPerson: {} };
    grouped[r.placeId].byPerson[r.personName] = r.value;
  }
  for (const g of Object.values(grouped)) {
    g.total = Object.values(g.byPerson).reduce((a, b) => a + b, 0);
  }
  res.json(grouped);
});

export const tempClosedRouter = Router();
tempClosedRouter.get('/', async (req, res) => {
  const placeType = placeTypeFilter(req.query.placeType);
  const date = typeof req.query.date === 'string' ? req.query.date : today();
  const rows = await prisma.tempClosed.findMany({ where: { date, ...(placeType ? { placeType } : {}) } });
  res.json(rows.map((r) => r.placeId));
});

export const eatenRouter = Router();
eatenRouter.get('/', async (req, res) => {
  const placeType = placeTypeFilter(req.query.placeType);
  const person = typeof req.query.person === 'string' ? req.query.person : '';
  if (!person) {
    res.json({});
    return;
  }
  const rows = await prisma.eatenLog.findMany({ where: { personName: person, ...(placeType ? { placeType } : {}) } });
  const grouped: Record<string, string[]> = {};
  for (const r of rows) {
    (grouped[r.placeId] ??= []).push(r.date);
  }
  res.json(grouped);
});

export const menusRouter = Router();
menusRouter.get('/', async (req, res) => {
  const placeType = placeTypeFilter(req.query.placeType);
  const rows = await prisma.menu.findMany({ where: placeType ? { placeType } : {} });
  const grouped: Record<string, string> = {};
  for (const r of rows) grouped[r.placeId] = r.text;
  res.json(grouped);
});
