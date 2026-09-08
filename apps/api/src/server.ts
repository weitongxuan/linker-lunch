import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';

import { configRouter } from './routes/config.js';
import { shopsRouter } from './routes/shops.js';
import { drinksRouter, dessertsRouter } from './routes/afterPlaces.js';
import { parkingsRouter } from './routes/parkings.js';
import { marketRouter } from './routes/market.js';
import { placesRouter } from './routes/places.js';
import { reportsRouter } from './routes/reports.js';
import { photosRouter } from './routes/photos.js';
import { eatenRouter, menusRouter, ratingsRouter, tempClosedRouter, votesRouter } from './routes/bulk.js';
import { startMarketCron } from './lib/marketCron.js';

const PORT = Number(process.env.PORT) || 4000;
const PHOTOS_DIR = process.env.PHOTOS_DIR || './data/photos';
fs.mkdirSync(PHOTOS_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || true }));
app.use(express.json());
app.use('/photos', express.static(path.resolve(PHOTOS_DIR)));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

app.use('/api/config', configRouter);
app.use('/api/shops', shopsRouter);
app.use('/api/drinks', drinksRouter);
app.use('/api/desserts', dessertsRouter);
app.use('/api/parkings', parkingsRouter);
app.use('/api/market', marketRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/photos', photosRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/temp-closed', tempClosedRouter);
app.use('/api/eaten', eatenRouter);
app.use('/api/menus', menusRouter);
app.use('/api/places/:placeType/:placeId', placesRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: err instanceof Error ? err.message : 'internal error' });
});

if (process.env.MARKET_CRON_ENABLED !== 'false') startMarketCron();

app.listen(PORT, () => {
  console.log(`lunch-map api listening on :${PORT}`);
});
