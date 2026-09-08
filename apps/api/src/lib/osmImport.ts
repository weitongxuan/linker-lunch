import {
  guessCategory,
  guessParkingKind,
  parseOsmHours,
  tierOf,
  travelOf,
  type Config,
  type Parking,
  type Shop,
} from '@lunch-map/shared';
import { prisma } from './prisma.js';
import { fromShop } from './serialize.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

interface OsmElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

async function overpass(query: string): Promise<{ elements: OsmElement[] }> {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'lunch-map/1.0 (internal office lunch-recommendation tool)',
      // Overpass's Apache config 406s Node's default Accept header — be explicit.
      Accept: '*/*',
    },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`Overpass 回應 ${res.status}`);
  return res.json() as Promise<{ elements: OsmElement[] }>;
}

function pointOf(e: OsmElement): { lat: number; lng: number } | null {
  if (e.lat != null && e.lon != null) return { lat: e.lat, lng: e.lon };
  if (e.center) return { lat: e.center.lat, lng: e.center.lon };
  return null;
}

export interface OsmImportSummary {
  found: number;
  added: number;
  skippedDuplicate: number;
  skippedFar: number;
  needsReview: number;
}

/** 從 OpenStreetMap Overpass API 匯入辦公室 800m 內的餐廳/小吃/咖啡店,直接寫進 DB(按名字去重,不覆寫既有店家)。 */
export async function importShopsFromOsm(cfg: Config): Promise<OsmImportSummary> {
  const query = `[out:json][timeout:30];(
    nwr["amenity"~"^(restaurant|fast_food|cafe|food_court)$"](around:800,${cfg.office.lat},${cfg.office.lng});
  );out center tags;`;
  const { elements } = await overpass(query);

  const existing = await prisma.shop.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((s) => s.name));
  const parkRows = await prisma.parking.findMany();
  const parks: Parking[] = parkRows.map((p) => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng, kind: p.kind, rate: p.rate, searchMin: p.searchMin, spaces: p.spaces ?? undefined }));

  const summary: OsmImportSummary = { found: 0, added: 0, skippedDuplicate: 0, skippedFar: 0, needsReview: 0 };
  let seq = 1;

  for (const e of elements) {
    const tags = e.tags || {};
    const name = tags['name:zh'] || tags.name;
    const point = pointOf(e);
    if (!name || !point) continue;
    summary.found++;

    if (existingNames.has(name)) {
      summary.skippedDuplicate++;
      continue;
    }

    const hours = parseOsmHours(tags.opening_hours);
    const needsReview = hours == null;

    const draft: Shop = {
      id: '',
      name,
      lat: point.lat,
      lng: point.lng,
      category: guessCategory(name, tags.cuisine),
      price: 2,
      service: ['dine_in', 'takeout'],
      hours: hours ?? { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] },
      hoursUnknown: needsReview,
      hoursRaw: needsReview ? tags.opening_hours : undefined,
      note: '',
      needsReview,
    };

    const tier = tierOf(travelOf(draft, parks, cfg), cfg);
    if (tier === 'far') {
      summary.skippedFar++;
      continue;
    }

    const id = `osm${String(seq++).padStart(3, '0')}`;
    await prisma.shop.create({ data: fromShop({ ...draft, id }) });
    existingNames.add(name);
    summary.added++;
    if (needsReview) summary.needsReview++;
  }

  return summary;
}

/** 從 OpenStreetMap 匯入辦公室 1000m 內的停車場,直接寫進 DB(按名字去重)。 */
export async function importParkingsFromOsm(cfg: Config): Promise<OsmImportSummary> {
  const query = `[out:json][timeout:30];(
    nwr["amenity"="parking"](around:1000,${cfg.office.lat},${cfg.office.lng});
  );out center tags;`;
  const { elements } = await overpass(query);

  const existing = await prisma.parking.findMany({ select: { name: true } });
  const existingNames = new Set(existing.map((p) => p.name));

  const summary: OsmImportSummary = { found: 0, added: 0, skippedDuplicate: 0, skippedFar: 0, needsReview: 0 };
  let seq = 1;

  for (const e of elements) {
    const tags = e.tags || {};
    const access = tags.access || '';
    if (/private|no/i.test(access)) continue;
    const name = tags['name:zh'] || tags.name || `停車場 ${e.id}`;
    const point = pointOf(e);
    if (!point) continue;
    summary.found++;

    if (existingNames.has(name)) {
      summary.skippedDuplicate++;
      continue;
    }

    const spaces = tags.capacity ? Number.parseInt(tags.capacity, 10) : undefined;
    const rate = tags.fee === 'no' ? '免費' : tags.charge || '';

    const id = `pkOsm${String(seq++).padStart(3, '0')}`;
    await prisma.parking.create({
      data: {
        id,
        name,
        lat: point.lat,
        lng: point.lng,
        kind: guessParkingKind(tags.parking),
        rate,
        searchMin: 3, // 預設值,建議實測後手動調整
        spaces: Number.isFinite(spaces) ? spaces : null,
      },
    });
    existingNames.add(name);
    summary.added++;
  }

  return summary;
}
