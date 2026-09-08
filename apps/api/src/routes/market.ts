import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toMarket } from '../lib/serialize.js';
import { fetchAndStoreMarket } from '../lib/market.js';

export const marketRouter = Router();

marketRouter.get('/', async (_req, res) => {
  const row = await prisma.market.findFirst({ orderBy: { id: 'desc' } });
  if (!row) {
    res.status(404).json({ error: 'no market data yet' });
    return;
  }
  res.json(toMarket(row));
});

marketRouter.post('/refresh', async (_req, res) => {
  try {
    const row = await fetchAndStoreMarket();
    res.json(toMarket(row));
  } catch (err) {
    res.status(502).json({ error: err instanceof Error ? err.message : '抓行情失敗' });
  }
});
