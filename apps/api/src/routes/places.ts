import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { prisma } from '../lib/prisma.js';
import { requirePlaceType } from '../lib/placeType.js';
import { isIntInRange } from '../lib/validate.js';

const PHOTOS_DIR = process.env.PHOTOS_DIR || './data/photos';
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: PHOTOS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${req.params.placeType}-${req.params.placeId}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
});

interface PlaceParams extends Record<string, string> {
  placeType: string;
  placeId: string;
}

export const placesRouter = Router({ mergeParams: true });
placesRouter.use(requirePlaceType);

const MAX_MESSAGE_CHARS = 500;
const MAX_MENU_CHARS = 4000;
const MAX_VOTE = 99;

/**
 * 寫評分/投票/留言前先確認店家真的存在,不然會留下對不到任何店的孤兒資料。
 * 讀取不需要:店不存在時那些路由本來就回空陣列,多查一次只是白花一趟資料庫。
 */
placesRouter.use<PlaceParams>(async (req, res, next) => {
  if (req.method === 'GET') {
    next();
    return;
  }
  const { placeType, placeId } = req.params;
  const exists =
    placeType === 'shop'
      ? await prisma.shop.findUnique({ where: { id: placeId }, select: { id: true } })
      : await prisma.afterPlace.findFirst({ where: { id: placeId, placeType }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: `${placeType} ${placeId} not found` });
    return;
  }
  next();
});

function clean(name: string | undefined): string {
  return String(name || '').replace(/[|:]/g, '').trim().slice(0, 10) || '訪客';
}

// ---- 評分 ----
placesRouter.get<PlaceParams>('/ratings', async (req, res) => {
  const { placeType, placeId } = req.params;
  const rows = await prisma.rating.findMany({ where: { placeType, placeId } });
  const who: Record<string, number> = {};
  rows.forEach((r) => { who[r.personName] = r.score; });
  const vals = rows.map((r) => r.score).filter((v) => v > 0);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
  res.json({ avg, n: vals.length, who });
});

placesRouter.post<PlaceParams>('/ratings', async (req, res) => {
  const { placeType, placeId } = req.params;
  const person = clean(req.body.person);
  const score = Number(req.body.score) || 0;
  if (score !== 0 && !isIntInRange(score, 1, 5)) {
    res.status(400).json({ error: 'score must be an integer 1–5, or 0 to clear' });
    return;
  }
  if (score > 0) {
    await prisma.rating.upsert({
      where: { placeId_placeType_personName: { placeId, placeType, personName: person } },
      update: { score },
      create: { placeId, placeType, personName: person, score },
    });
  } else {
    await prisma.rating.deleteMany({ where: { placeId, placeType, personName: person } });
  }
  res.json({ ok: true });
});

// ---- 菜單 ----
placesRouter.get<PlaceParams>('/menu', async (req, res) => {
  const { placeType, placeId } = req.params;
  const row = await prisma.menu.findUnique({ where: { placeId_placeType: { placeId, placeType } } });
  res.json({ text: row?.text ?? '' });
});

placesRouter.put<PlaceParams>('/menu', async (req, res) => {
  const { placeType, placeId } = req.params;
  const text = String(req.body.text ?? '');
  if (text.length > MAX_MENU_CHARS) {
    res.status(400).json({ error: `menu text too long (max ${MAX_MENU_CHARS} chars)` });
    return;
  }
  if (text) {
    await prisma.menu.upsert({
      where: { placeId_placeType: { placeId, placeType } },
      update: { text },
      create: { placeId, placeType, text },
    });
  } else {
    await prisma.menu.deleteMany({ where: { placeId, placeType } });
  }
  res.json({ ok: true });
});

// ---- 照片 ----
placesRouter.get<PlaceParams>('/photos', async (req, res) => {
  const { placeType, placeId } = req.params;
  const rows = await prisma.photo.findMany({ where: { placeType, placeId }, orderBy: { createdAt: 'asc' } });
  res.json(rows.map((p) => ({ id: p.id, url: `/photos/${p.filename}`, who: p.uploaderName, date: p.createdAt.toISOString().slice(0, 10), kb: p.sizeKb, shared: p.isShared })));
});

placesRouter.post<PlaceParams>('/photos', upload.single('photo'), async (req, res) => {
  const { placeType, placeId } = req.params;
  if (!req.file) {
    res.status(400).json({ error: 'no file' });
    return;
  }
  const row = await prisma.photo.create({
    data: {
      placeType, placeId,
      filename: req.file.filename,
      uploaderName: clean(req.body.who),
      sizeKb: Math.round(req.file.size / 1024),
      isShared: req.body.shared !== 'false',
    },
  });
  res.status(201).json({ id: row.id, url: `/photos/${row.filename}`, who: row.uploaderName, date: row.createdAt.toISOString().slice(0, 10), kb: row.sizeKb, shared: row.isShared });
});

// ---- 投票 ----
placesRouter.get<PlaceParams>('/votes', async (req, res) => {
  const { placeType, placeId } = req.params;
  const rows = await prisma.vote.findMany({ where: { placeType, placeId } });
  res.json({ total: rows.reduce((s, r) => s + r.value, 0), byPerson: Object.fromEntries(rows.map((r) => [r.personName, r.value])) });
});

placesRouter.post<PlaceParams>('/votes', async (req, res) => {
  const { placeType, placeId } = req.params;
  const person = clean(req.body.person);
  const value = Number(req.body.value) || 0;
  if (!isIntInRange(value, 0, MAX_VOTE)) {
    res.status(400).json({ error: `value must be an integer 0–${MAX_VOTE}` });
    return;
  }
  await prisma.vote.upsert({
    where: { placeId_placeType_personName: { placeId, placeType, personName: person } },
    update: { value },
    create: { placeId, placeType, personName: person, value },
  });
  res.json({ ok: true });
});

// ---- 留言板 ----
placesRouter.get<PlaceParams>('/messages', async (req, res) => {
  const { placeType, placeId } = req.params;
  const rows = await prisma.message.findMany({ where: { placeType, placeId }, orderBy: { createdAt: 'asc' } });
  res.json(rows.map((m) => ({ id: m.id, who: m.personName, text: m.text, date: m.createdAt.toISOString().slice(0, 10) })));
});

placesRouter.post<PlaceParams>('/messages', async (req, res) => {
  const { placeType, placeId } = req.params;
  const person = clean(req.body.person);
  const text = String(req.body.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'empty text' });
    return;
  }
  if (text.length > MAX_MESSAGE_CHARS) {
    res.status(400).json({ error: `message too long (max ${MAX_MESSAGE_CHARS} chars)` });
    return;
  }
  const row = await prisma.message.create({ data: { placeType, placeId, personName: person, text } });
  res.status(201).json({ id: row.id, who: row.personName, text: row.text, date: row.createdAt.toISOString().slice(0, 10) });
});
