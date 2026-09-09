export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export const ORDER: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
export const TABS: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri'];

export const LABEL: Record<DayKey, string> = {
  mon: '週一', tue: '週二', wed: '週三', thu: '週四', fri: '週五', sat: '週六', sun: '週日',
};

/** [開始, 結束] 24h "HH:MM"。跨夜可以寫 close <= open,計算時自動 +1440。 */
export type HourRange = [string, string];

export type WeeklyHours = Record<DayKey, HourRange[]>;

export type PlaceType = 'shop' | 'drink' | 'dessert';

export type Service = 'dine_in' | 'takeout' | 'delivery';

export interface Peak {
  from: string;
  to: string;
  note?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface Shop extends LatLng {
  id: string;
  name: string;
  category: string;
  price: 1 | 2 | 3 | 4 | null;
  service: Service[];
  hours: WeeklyHours;
  hoursUnknown?: boolean;
  addr?: string;
  phone?: string;
  note: string;
  hoursSource?: string;
  hoursRaw?: string;
  googleRating?: number;
  googleReviews?: number;
  /** 人工覆寫:有填就不算,略過距離推算 */
  walkMin?: number;
  driveMin?: number;
  ownParking?: boolean;
  peak?: Peak;
  closedNote?: string;
  needsReview?: boolean;
}

/** drinks / desserts 共用的簡化店家形狀(沒有 category/service/交通覆寫/peak) */
export interface AfterPlace extends LatLng {
  id: string;
  name: string;
  kind: string;
  price: 1 | 2 | 3 | 4 | null;
  hours: WeeklyHours;
  hoursUnknown?: boolean;
  addr?: string;
  phone?: string;
  note: string;
  hoursSource?: string;
  hoursRaw?: string;
  googleRating?: number;
  googleReviews?: number;
}

export interface Parking extends LatLng {
  id: string;
  name: string;
  kind: string;
  rate: string;
  searchMin: number;
  spaces?: number;
}

export interface PriceBand {
  v: 1 | 2 | 3 | 4;
  label: string;
}

export interface Config {
  office: LatLng & { name: string };
  depart: { start: string; end: string };
  backBy: string;
  eatMinutes: number;
  priceBands: PriceBand[];
  walkSpeed: number;
  detour: number;
  maxWalkMin: number;
  driveSpeed: number;
  parkSearch: number;
  streetSearch: number;
  driveWorthIt: number;
  maxDriveMin: number;
}

export interface Market {
  date: string;
  index: string;
  close: number;
  pct: number;
  src: string;
}

/** feasibility() 可能回傳的狀態碼,依「有多糟」排序(見 sort.ts 的 RANK) */
export type FeasibilityCode =
  | 'ok'
  | 'tight'
  | 'unknown'
  | 'not_enough'
  | 'not_lunch'
  | 'closed'
  | 'no_time'
  | 'out_of_range';

export interface Feasibility {
  code: FeasibilityCode;
  label: string;
  why?: string;
  travelMin?: number;
  usable?: number;
  seg?: { os: number; oe: number; len: number };
  winS?: number;
  winE?: number;
  suggestDepart?: number;
  latestDepart?: number;
}

export type OpenNowCode = 'open' | 'unknown' | 'later' | 'closed';

export interface OpenNowState {
  code: OpenNowCode;
  label: string;
  note?: string;
}

export interface Travel {
  meters: number;
  walk: number;
  drive: number;
  park: Parking | null;
  parkWalk: number;
  street?: boolean;
  searchMin?: number;
  ownParking?: boolean;
}

export type Tier = 'w5' | 'w10' | 'd10' | 'far';

export type TravelMode = 'auto' | 'walk' | 'drive';

export interface PickedTravel {
  min: number;
  by: 'walk' | 'drive';
}

export type Mood = 'up' | 'flat' | 'down';

export interface ScoreInfo {
  avg: number;
  n: number;
  mine?: number;
  who?: Record<string, number>;
}
