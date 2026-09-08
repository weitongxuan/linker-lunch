import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toConfig, toParking } from '../lib/serialize.js';
import { importParkingsFromOsm } from '../lib/osmImport.js';

export const parkingsRouter = Router();

parkingsRouter.get('/', async (_req, res) => {
  const rows = await prisma.parking.findMany({ orderBy: { name: 'asc' } });
  res.json(rows.map(toParking));
});

parkingsRouter.post('/import/osm', async (_req, res) => {
  const cfgRow = await prisma.config.findUnique({ where: { id: 1 } });
  if (!cfgRow) {
    res.status(400).json({ error: 'config not seeded yet — run `npm run seed`' });
    return;
  }
  try {
    const summary = await importParkingsFromOsm(toConfig(cfgRow));
    res.json(summary);
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : 'OSM 匯入失敗' });
  }
});
