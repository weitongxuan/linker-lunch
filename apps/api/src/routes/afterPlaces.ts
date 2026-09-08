import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toAfterPlace } from '../lib/serialize.js';

function afterPlaceRouter(placeType: 'drink' | 'dessert') {
  const router = Router();
  router.get('/', async (_req, res) => {
    const rows = await prisma.afterPlace.findMany({ where: { placeType }, orderBy: { name: 'asc' } });
    res.json(rows.map(toAfterPlace));
  });
  return router;
}

export const drinksRouter = afterPlaceRouter('drink');
export const dessertsRouter = afterPlaceRouter('dessert');
