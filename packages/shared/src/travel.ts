import type { Config, LatLng, Parking, PickedTravel, Tier, Travel, TravelMode } from './types.js';

/** travelOf()/driveVia() 只需要這幾個欄位 —— shops 跟 drinks/desserts(AfterPlace)都適用。 */
export interface TravelSubject extends LatLng {
  walkMin?: number;
  driveMin?: number;
  ownParking?: boolean;
}

/** 兩點間大圓距離(公尺) */
export function haversine(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function walkMinFor(meters: number, cfg: Config): number {
  return Math.max(1, Math.ceil((meters * cfg.detour) / cfg.walkSpeed));
}

function driveMinFor(meters: number, cfg: Config): number {
  return Math.max(1, Math.ceil((meters * cfg.detour) / cfg.driveSpeed));
}

/**
 * 開車去這家店最划算的方式:試每個登記過的停車場(開到停車場+找位+走到店),
 * 跟「直接開到店附近路邊找位」比,取總時間較少的那個。
 * 有 shop.driveMin 人工覆寫就直接用,完全跳過停車場搜尋。
 */
interface DriveCandidate {
  min: number;
  park: Parking | null;
  parkWalk: number;
  street?: boolean;
  searchMin?: number;
}

export function driveVia(shop: TravelSubject, parks: Parking[], cfg: Config): Travel {
  if (shop.driveMin != null) {
    return { meters: 0, walk: 0, drive: shop.driveMin, park: null, parkWalk: 0 };
  }
  let best: DriveCandidate | null = null;
  for (const p of parks) {
    const parkWalk = walkMinFor(haversine(p, shop), cfg);
    const min = driveMinFor(haversine(cfg.office, p), cfg) + (p.searchMin ?? cfg.parkSearch) + parkWalk;
    if (!best || min < best.min) best = { min, park: p, parkWalk };
  }
  const search = shop.ownParking ? 1 : cfg.streetSearch;
  const street: DriveCandidate = {
    min: driveMinFor(haversine(cfg.office, shop), cfg) + search,
    park: null,
    parkWalk: 0,
    street: true,
    searchMin: search,
  };
  const chosen = !best || street.min < best.min ? street : best;
  return {
    meters: 0,
    walk: 0,
    drive: chosen.min,
    park: chosen.park,
    parkWalk: chosen.parkWalk,
    street: chosen.street,
    searchMin: chosen.searchMin,
  };
}

export function travelOf(shop: TravelSubject, parks: Parking[], cfg: Config): Travel {
  const meters = haversine(cfg.office, shop);
  const walk = shop.walkMin ?? walkMinFor(meters, cfg);
  const d = driveVia(shop, parks, cfg);
  return { ...d, meters, walk, ownParking: shop.ownParking };
}

export function tierOf(t: Travel, cfg: Config): Tier {
  if (t.walk <= 5) return 'w5';
  if (t.walk <= cfg.maxWalkMin) return 'w10';
  if (t.drive <= cfg.maxDriveMin) return 'd10';
  return 'far';
}

/**
 * auto 模式下走路 vs 開車的取捨:開車只有在比走路省 >= driveWorthIt 分鐘時才會選開車
 * (400 公尺沒有人會開車)。walk/drive 強制模式下,超出對應上限就回傳 null(= out_of_range)。
 */
export function pickTravel(t: Travel, mode: TravelMode, cfg: Config): PickedTravel | null {
  const wOK = t.walk <= cfg.maxWalkMin;
  const dOK = t.drive <= cfg.maxDriveMin;
  if (mode === 'walk') return wOK ? { min: t.walk, by: 'walk' } : null;
  if (mode === 'drive') return dOK ? { min: t.drive, by: 'drive' } : null;
  if (wOK && dOK) {
    return t.walk - t.drive >= cfg.driveWorthIt ? { min: t.drive, by: 'drive' } : { min: t.walk, by: 'walk' };
  }
  if (wOK) return { min: t.walk, by: 'walk' };
  if (dOK) return { min: t.drive, by: 'drive' };
  return null;
}
