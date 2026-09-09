import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Service, WeeklyHours } from '@lunch-map/shared';
import { prisma } from '../lib/prisma.js';
import { fromShop, toConfig, toShop } from '../lib/serialize.js';
import { importShopsFromOsm } from '../lib/osmImport.js';

export const shopsRouter = Router();

const SERVICES: Service[] = ['dine_in', 'takeout', 'delivery'];
const EMPTY_HOURS: WeeklyHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

shopsRouter.get('/', async (_req, res) => {
  const rows = await prisma.shop.findMany({ orderBy: { name: 'asc' } });
  res.json(rows.map(toShop));
});

shopsRouter.post('/', async (req, res) => {
  const body = req.body ?? {};
  const name = String(body.name || '').trim();
  const lat = Number(body.lat);
  const lng = Number(body.lng);
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: '店名跟座標是必填的' });
    return;
  }

  const price = [1, 2, 3, 4].includes(Number(body.price)) ? (Number(body.price) as 1 | 2 | 3 | 4) : null;
  const service = Array.isArray(body.service) ? body.service.filter((s: unknown): s is Service => SERVICES.includes(s as Service)) : [];
  const hoursUnknown = !!body.hoursUnknown;
  const hours = hoursUnknown ? EMPTY_HOURS : ((body.hours as WeeklyHours) ?? EMPTY_HOURS);

  const row = await prisma.shop.create({
    data: fromShop({
      id: `manual-${randomUUID()}`,
      name,
      lat,
      lng,
      category: String(body.category || '').trim() || '其他',
      price,
      service,
      hours,
      hoursUnknown,
      addr: body.addr ? String(body.addr).trim() : undefined,
      note: body.note ? String(body.note).trim() : '',
      needsReview: false,
    }),
  });
  res.status(201).json(toShop(row));
});

shopsRouter.post('/import/osm', async (_req, res) => {
  const cfgRow = await prisma.config.findUnique({ where: { id: 1 } });
  if (!cfgRow) {
    res.status(400).json({ error: 'config not seeded yet — run `npm run seed`' });
    return;
  }
  try {
    const summary = await importShopsFromOsm(toConfig(cfgRow));
    res.json(summary);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'OSM 匯入失敗' });
  }
});
