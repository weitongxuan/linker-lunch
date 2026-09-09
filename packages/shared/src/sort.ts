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
  price: new Set(),
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

/** 評分相關的篩選:沒人評過的店不會被當成「差」,只有明確開 hideUnrated 才會被排除 */
export function passScore(r: ComputedRow, filters: FilterState): boolean {
  if (filters.minGoogle && r.sh.googleRating != null && r.sh.googleRating < filters.minGoogle) return false;
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
  if (filters.cat.size) {
    const cats = r.sh.category.length ? r.sh.category : ['其他'];
    if (!cats.some((c) => filters.cat.has(c))) return false;
  }
  if (filters.price.size && !filters.price.has(String(r.sh.price || ''))) return false;
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
