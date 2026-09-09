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
  const categoryList = Array.isArray(body.category) ? body.category : [body.category];
  const category = categoryList.map((c: unknown) => String(c || '').trim()).filter(Boolean);
  const hoursUnknown = !!body.hoursUnknown;
  const hours = hoursUnknown ? EMPTY_HOURS : ((body.hours as WeeklyHours) ?? EMPTY_HOURS);

  const row = await prisma.shop.create({
    data: fromShop({
      id: `manual-${randomUUID()}`,
      name,
      lat,
      lng,
      category: category.length ? category : ['其他'],
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

shopsRouter.put('/:id', async (req, res) => {
  const existing = await prisma.shop.findUnique({ where: { id: req.params.id } });
  if (!existing) {
    res.status(404).json({ error: '找不到這間店' });
    return;
  }
  const current = toShop(existing);
  const body = req.body ?? {};

  const name = body.name !== undefined ? String(body.name).trim() : current.name;
  const lat = body.lat !== undefined ? Number(body.lat) : current.lat;
  const lng = body.lng !== undefined ? Number(body.lng) : current.lng;
  if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: '店名跟座標是必填的' });
    return;
  }

  const price = body.price !== undefined
    ? ([1, 2, 3, 4].includes(Number(body.price)) ? (Number(body.price) as 1 | 2 | 3 | 4) : null)
    : current.price;
  const service = body.service !== undefined
    ? (Array.isArray(body.service) ? body.service.filter((s: unknown): s is Service => SERVICES.includes(s as Service)) : [])
    : current.service;
  const category = body.category !== undefined
    ? (Array.isArray(body.category) ? body.category : [body.category]).map((c: unknown) => String(c || '').trim()).filter(Boolean)
    : current.category;
  const hoursUnknown = body.hoursUnknown !== undefined ? !!body.hoursUnknown : current.hoursUnknown;
  const hours = hoursUnknown ? EMPTY_HOURS : body.hours !== undefined ? (body.hours as WeeklyHours) : current.hours;

  const row = await prisma.shop.update({
    where: { id: req.params.id },
    data: fromShop({
      ...current,
      name,
      lat,
      lng,
      category: category.length ? category : ['其他'],
      price,
      service,
      hours,
      hoursUnknown,
      addr: body.addr !== undefined ? (body.addr ? String(body.addr).trim() : undefined) : current.addr,
      phone: body.phone !== undefined ? (body.phone ? String(body.phone).trim() : undefined) : current.phone,
      note: body.note !== undefined ? String(body.note).trim() : current.note,
    }),
  });
  res.json(toShop(row));
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
