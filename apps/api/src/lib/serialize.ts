import type { AfterPlace, Config, Market, Parking, PriceBand, Service, Shop, WeeklyHours } from '@lunch-map/shared';

type ShopRow = {
  id: string; name: string; lat: number; lng: number; category: string; price: number | null;
  service: string; hours: string; hoursUnknown: boolean; addr: string | null; phone: string | null;
  note: string; hoursSource: string | null; hoursRaw: string | null; googleRating: number | null;
  googleReviews: number | null; walkMin: number | null; driveMin: number | null; ownParking: boolean | null;
  peakFrom: string | null; peakTo: string | null; peakNote: string | null; closedNote: string | null;
  needsReview: boolean;
};

export function toShop(row: ShopRow): Shop {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    category: row.category,
    price: (row.price as Shop['price']) ?? null,
    service: JSON.parse(row.service) as Service[],
    hours: JSON.parse(row.hours) as WeeklyHours,
    hoursUnknown: row.hoursUnknown,
    addr: row.addr ?? undefined,
    phone: row.phone ?? undefined,
    note: row.note,
    hoursSource: row.hoursSource ?? undefined,
    hoursRaw: row.hoursRaw ?? undefined,
    googleRating: row.googleRating ?? undefined,
    googleReviews: row.googleReviews ?? undefined,
    walkMin: row.walkMin ?? undefined,
    driveMin: row.driveMin ?? undefined,
    ownParking: row.ownParking ?? undefined,
    peak: row.peakFrom && row.peakTo ? { from: row.peakFrom, to: row.peakTo, note: row.peakNote ?? undefined } : undefined,
    closedNote: row.closedNote ?? undefined,
    needsReview: row.needsReview,
  };
}

export function fromShop(shop: Shop) {
  return {
    id: shop.id,
    name: shop.name,
    lat: shop.lat,
    lng: shop.lng,
    category: shop.category,
    price: shop.price,
    service: JSON.stringify(shop.service),
    hours: JSON.stringify(shop.hours),
    hoursUnknown: shop.hoursUnknown ?? false,
    addr: shop.addr ?? null,
    phone: shop.phone ?? null,
    note: shop.note ?? '',
    hoursSource: shop.hoursSource ?? null,
    hoursRaw: shop.hoursRaw ?? null,
    googleRating: shop.googleRating ?? null,
    googleReviews: shop.googleReviews ?? null,
    walkMin: shop.walkMin ?? null,
    driveMin: shop.driveMin ?? null,
    ownParking: shop.ownParking ?? null,
    peakFrom: shop.peak?.from ?? null,
    peakTo: shop.peak?.to ?? null,
    peakNote: shop.peak?.note ?? null,
    closedNote: shop.closedNote ?? null,
    needsReview: shop.needsReview ?? false,
  };
}

type AfterPlaceRow = {
  id: string; placeType: string; name: string; lat: number; lng: number; kind: string; price: number | null;
  hours: string; hoursUnknown: boolean; addr: string | null; phone: string | null; note: string;
  hoursSource: string | null; hoursRaw: string | null; googleRating: number | null; googleReviews: number | null;
};

export function toAfterPlace(row: AfterPlaceRow): AfterPlace {
  return {
    id: row.id,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    kind: row.kind,
    price: (row.price as AfterPlace['price']) ?? null,
    hours: JSON.parse(row.hours) as WeeklyHours,
    hoursUnknown: row.hoursUnknown,
    addr: row.addr ?? undefined,
    phone: row.phone ?? undefined,
    note: row.note,
    hoursSource: row.hoursSource ?? undefined,
    hoursRaw: row.hoursRaw ?? undefined,
    googleRating: row.googleRating ?? undefined,
    googleReviews: row.googleReviews ?? undefined,
  };
}

export function fromAfterPlace(place: AfterPlace, placeType: 'drink' | 'dessert') {
  return {
    id: place.id,
    placeType,
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    kind: place.kind,
    price: place.price,
    hours: JSON.stringify(place.hours),
    hoursUnknown: place.hoursUnknown ?? false,
    addr: place.addr ?? null,
    phone: place.phone ?? null,
    note: place.note ?? '',
    hoursSource: place.hoursSource ?? null,
    hoursRaw: place.hoursRaw ?? null,
    googleRating: place.googleRating ?? null,
    googleReviews: place.googleReviews ?? null,
  };
}

type ParkingRow = { id: string; name: string; lat: number; lng: number; kind: string; rate: string; searchMin: number; spaces: number | null };

export function toParking(row: ParkingRow): Parking {
  return { id: row.id, name: row.name, lat: row.lat, lng: row.lng, kind: row.kind, rate: row.rate, searchMin: row.searchMin, spaces: row.spaces ?? undefined };
}

type ConfigRow = {
  officeLat: number; officeLng: number; officeName: string; departStart: string; departEnd: string;
  backBy: string; eatMinutes: number; priceBands: string; walkSpeed: number; detour: number;
  maxWalkMin: number; driveSpeed: number; parkSearch: number; streetSearch: number; driveWorthIt: number; maxDriveMin: number;
};

export function toConfig(row: ConfigRow): Config {
  return {
    office: { lat: row.officeLat, lng: row.officeLng, name: row.officeName },
    depart: { start: row.departStart, end: row.departEnd },
    backBy: row.backBy,
    eatMinutes: row.eatMinutes,
    priceBands: JSON.parse(row.priceBands) as PriceBand[],
    walkSpeed: row.walkSpeed,
    detour: row.detour,
    maxWalkMin: row.maxWalkMin,
    driveSpeed: row.driveSpeed,
    parkSearch: row.parkSearch,
    streetSearch: row.streetSearch,
    driveWorthIt: row.driveWorthIt,
    maxDriveMin: row.maxDriveMin,
  };
}

type MarketRow = { date: string; indexName: string; close: number; pct: number; src: string };

export function toMarket(row: MarketRow): Market {
  return { date: row.date, index: row.indexName, close: row.close, pct: row.pct, src: row.src };
}
