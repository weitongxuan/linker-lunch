import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '../lib/prisma.js';

const PHOTOS_DIR = process.env.PHOTOS_DIR || './data/photos';

export const photosRouter = Router();

photosRouter.delete('/:id', async (req, res) => {
  const row = await prisma.photo.findUnique({ where: { id: req.params.id } });
  if (!row) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  await prisma.photo.delete({ where: { id: row.id } });
  fs.unlink(path.join(PHOTOS_DIR, row.filename), () => {});
  res.json({ ok: true });
});
