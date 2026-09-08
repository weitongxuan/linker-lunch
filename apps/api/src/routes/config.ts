import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toConfig } from '../lib/serialize.js';

export const configRouter = Router();

configRouter.get('/', async (_req, res) => {
  const row = await prisma.config.findUnique({ where: { id: 1 } });
  if (!row) {
    res.status(404).json({ error: 'config not seeded yet — run `npm run seed`' });
    return;
  }
  res.json(toConfig(row));
});
