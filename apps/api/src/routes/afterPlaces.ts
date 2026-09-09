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

  return router;
}

export const drinksRouter = afterPlaceRouter('drink');
export const dessertsRouter = afterPlaceRouter('dessert');
