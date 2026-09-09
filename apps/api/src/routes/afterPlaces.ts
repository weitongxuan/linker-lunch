import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { WeeklyHours } from '@lunch-map/shared';
import { prisma } from '../lib/prisma.js';
import { fromAfterPlace, toAfterPlace } from '../lib/serialize.js';

const EMPTY_HOURS: WeeklyHours = { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };

function afterPlaceRouter(placeType: 'drink' | 'dessert') {
  const router = Router();
  router.get('/', async (_req, res) => {
    const rows = await prisma.afterPlace.findMany({ where: { placeType }, orderBy: { name: 'asc' } });
    res.json(rows.map(toAfterPlace));
  });

  router.post('/', async (req, res) => {
    const body = req.body ?? {};
    const name = String(body.name || '').trim();
    const lat = Number(body.lat);
    const lng = Number(body.lng);
    if (!name || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).json({ error: '店名跟座標是必填的' });
      return;
    }

    const price = [1, 2, 3, 4].includes(Number(body.price)) ? (Number(body.price) as 1 | 2 | 3 | 4) : null;
    const hoursUnknown = !!body.hoursUnknown;
    const hours = hoursUnknown ? EMPTY_HOURS : ((body.hours as WeeklyHours) ?? EMPTY_HOURS);

    const row = await prisma.afterPlace.create({
      data: fromAfterPlace(
        {
          id: `manual-${randomUUID()}`,
          name,
          lat,
          lng,
          kind: body.kind ? String(body.kind).trim() : '其他',
          price,
          hours,
          hoursUnknown,
          addr: body.addr ? String(body.addr).trim() : undefined,
          note: body.note ? String(body.note).trim() : '',
        },
        placeType,
      ),
    });
    res.status(201).json(toAfterPlace(row));
  });

  router.put('/:id', async (req, res) => {
    const existing = await prisma.afterPlace.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.placeType !== placeType) {
      res.status(404).json({ error: '找不到這間店' });
      return;
    }
    const current = toAfterPlace(existing);
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
    const hoursUnknown = body.hoursUnknown !== undefined ? !!body.hoursUnknown : current.hoursUnknown;
    const hours = hoursUnknown ? EMPTY_HOURS : body.hours !== undefined ? (body.hours as WeeklyHours) : current.hours;

    const row = await prisma.afterPlace.update({
      where: { id: req.params.id },
      data: fromAfterPlace(
        {
          ...current,
          name,
          lat,
          lng,
          kind: body.kind !== undefined ? String(body.kind).trim() || '其他' : current.kind,
          price,
          hours,
          hoursUnknown,
          addr: body.addr !== undefined ? (body.addr ? String(body.addr).trim() : undefined) : current.addr,
          phone: body.phone !== undefined ? (body.phone ? String(body.phone).trim() : undefined) : current.phone,
          note: body.note !== undefined ? String(body.note).trim() : current.note,
        },
        placeType,
      ),
    });
    res.json(toAfterPlace(row));
  });

  router.delete('/:id', async (req, res) => {
    const existing = await prisma.afterPlace.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.placeType !== placeType) {
      res.status(404).json({ error: '找不到這間店' });
      return;
    }
    await prisma.afterPlace.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  });

  return router;
}

export const drinksRouter = afterPlaceRouter('drink');
export const dessertsRouter = afterPlaceRouter('dessert');
