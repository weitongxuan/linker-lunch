import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toConfig, toShop } from '../lib/serialize.js';
import { importShopsFromOsm } from '../lib/osmImport.js';

export const shopsRouter = Router();

shopsRouter.get('/', async (_req, res) => {
  const rows = await prisma.shop.findMany({ orderBy: { name: 'asc' } });
  res.json(rows.map(toShop));
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
