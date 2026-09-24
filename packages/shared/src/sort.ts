import type { OpenNowCode, OpenNowState, ScoreInfo, Service, Shop, Tier, Travel } from './types.js';

/** 狀態嚴重程度排序:open 最好,out_of_range 最差,永遠是排序的第一優先鍵 */
export const RANK: Record<OpenNowCode, number> = {
  open: 0,
  later: 1,
  unknown: 2,
  closed: 3,
  out_of_range: 4,
};

export type SortKey = 'travel' | 'score' | 'votes';

export interface FilterState {
  tier: Set<Tier>;
  cat: Set<string>;
  excludeCat: Set<string>;
  cuisine: Set<string>;
  excludeCuisine: Set<string>;
  price: Set<string>;
  service: Set<Service>;
  onlyOpen: boolean;
  showUnknown: boolean;
  hideBad: boolean;
  badBelow: number;
  minScore: number;
  hideUnrated: boolean;
  minGoogle: number;
}

export const DEFAULT_FILTERS: FilterState = {
  tier: new Set(),
  cat: new Set(),
  excludeCat: new Set(),
  cuisine: new Set(),
  excludeCuisine: new Set(),
  // 預設只看 $$$ 以下:午餐一個人 500 元以上的店平常不會是選項,要看再到篩選把 $$$$ 點開
  price: new Set(['1', '2', '3']),
  service: new Set(),
  onlyOpen: true,
  showUnknown: true,
  hideBad: true,
  badBelow: 2.5,
  minScore: 0,
  hideUnrated: false,
  minGoogle: 0,
};

export interface ComputedRow {
  sh: Shop;
  t: Travel;
  tier: Tier;
  by: 'walk' | 'drive' | null;
  f: OpenNowState;
  travelMin: number | null;
  sc: ScoreInfo;
  votes: number;
  feasible: boolean;
}

/** 只看評分相關欄位,所以餐廳(ComputedRow)和飲料列都能用 */
export interface Scorable {
  sh: { googleRating?: number | null };
  sc: { n: number; avg: number };
}

/** 評分相關的篩選:沒人評過的店不會被當成「差」,只有明確開 hideUnrated 才會被排除 */
export function passScore(r: Scorable, filters: FilterState): boolean {
  // 要求 Google 幾分以上時,沒有 Google 評分的店也不算過,否則「Google 4 分以上」會抽到沒分數的店
  if (filters.minGoogle && (r.sh.googleRating == null || r.sh.googleRating < filters.minGoogle)) return false;
  if (!r.sc.n) return !filters.hideUnrated;
  if (filters.hideBad && r.sc.avg < filters.badBelow) return false;
  if (filters.minScore && r.sc.avg < filters.minScore) return false;
  return true;
}

export function passFilter(r: ComputedRow, filters: FilterState): boolean {
  if (r.tier === 'far' || r.f.code === 'out_of_range') return false;
  if (!passScore(r, filters)) return false;
  if (filters.tier.size && !filters.tier.has(r.tier)) return false;
  if (filters.onlyOpen && !r.feasible && !(filters.showUnknown && r.f.code === 'unknown')) return false;
  if (filters.cat.size || filters.excludeCat.size) {
    const cats = r.sh.category.length ? r.sh.category : ['其他'];
    if (filters.cat.size && !cats.some((c) => filters.cat.has(c))) return false;
    if (filters.excludeCat.size && cats.some((c) => filters.excludeCat.has(c))) return false;
  }
  // 菜系:沒有菜系的店在「想吃某菜系」時被排除,在「不吃某菜系」時不受影響
  if (filters.cuisine.size && !(r.sh.cuisine && filters.cuisine.has(r.sh.cuisine))) return false;
  if (filters.excludeCuisine.size && r.sh.cuisine && filters.excludeCuisine.has(r.sh.cuisine)) return false;
  // 沒有價位的店不因價位篩選被藏掉:不知道 ≠ 貴,跟 hoursUnknown 用 showUnknown 放行是同一個道理
  if (filters.price.size && r.sh.price && !filters.price.has(String(r.sh.price))) return false;
  if (filters.service.size) {
    const sv = r.sh.service || [];
    let hit = false;
    filters.service.forEach((x) => {
      if (sv.indexOf(x) >= 0) hit = true;
    });
    if (!hit) return false;
  }
  return true;
}

export function sortRows(rows: ComputedRow[], sortKey: SortKey): ComputedRow[] {
  const K: Record<SortKey, (r: ComputedRow) => number> = {
    travel: (r) => (r.travelMin == null ? 99 : r.travelMin),
    score: (r) => -(r.sc.n ? r.sc.avg : 0),
    votes: (r) => -r.votes,
  };
  const key = K[sortKey];
  return [...rows].sort(
    (a, b) =>
      RANK[a.f.code] - RANK[b.f.code] ||
      key(a) - key(b) ||
      (a.travelMin == null ? 99 : a.travelMin) - (b.travelMin == null ? 99 : b.travelMin) ||
      a.sh.name.localeCompare(b.sh.name, 'zh-Hant'),
  );
}
