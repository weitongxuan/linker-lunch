import { useMemo } from 'react';
import { findMenuItems, fitsBudget, openNowState, passFilter, pickTravel, sortRows, tierOf, travelOf } from '@lunch-map/shared';
import type { Config, OpenNowState, Parking, Shop } from '@lunch-map/shared';
import type { ComputedRow } from '@lunch-map/shared';
import { useFilters } from '../state/filtersStore.js';

export type Row = ComputedRow;

interface RatingMap {
  [placeId: string]: { avg: number; n: number; who: Record<string, number> };
}

interface VoteMap {
  [placeId: string]: { total: number; byPerson: Record<string, number> };
}

interface Args {
  config: Config | undefined;
  shops: Shop[];
  parkings: Parking[];
  ratings: RatingMap;
  votes: VoteMap;
  nowMinute: number;
}

/** 對照原本的 computeAll():每家店算一次交通時間、營業狀態、評分、投票。 */
export function useComputedRows({ config, shops, parkings, ratings, votes, nowMinute }: Args): Row[] {
  const { state } = useFilters();

  return useMemo(() => {
    if (!config) return [];

    return shops.map((sh): Row => {
      const t = travelOf(sh, parkings, config);
      const tier = tierOf(t, config);
      const pt = pickTravel(t, state.mode, config);

      const f: OpenNowState = pt ? openNowState(sh, state.day, nowMinute) : { code: 'out_of_range', label: '超出範圍' };

      const sc = ratings[sh.id] ?? { avg: 0, n: 0, who: {} };
      const voteTotal = votes[sh.id]?.total ?? 0;

      return {
        sh,
        t,
        tier,
        by: pt?.by ?? null,
        f,
        travelMin: pt?.min ?? null,
        sc,
        votes: voteTotal,
        feasible: f.code === 'open',
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.filters/state.sort intentionally excluded, only day/mode/nowMinute affect row computation
  }, [config, shops, parkings, ratings, votes, state.day, state.mode, nowMinute]);
}

function matchesKeyword(r: Row, keyword: string, menuText: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  const haystack = [r.sh.name, ...r.sh.category, r.sh.addr, r.sh.note].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(kw) || findMenuItems(menuText, kw, 1).length > 0;
}

/**
 * 篩選 + 排序過的可見清單 —— 給地圖跟清單共用同一份順序。
 * 菜單相關條件:預算只排除「有價格、而且預算內不到 3 道」的店,沒菜單的店不知道就留著;
 * 菜名(與預算)命中的店穩定地排到最前面,其餘照原本的排序。
 */
export function useVisibleRows(rows: Row[], menus: Record<string, string>): Row[] {
  const { state } = useFilters();
  return useMemo(() => {
    const { dish, budget } = state.filters;
    const kept = rows.filter((r) => {
      if (!passFilter(r, state.filters) || !matchesKeyword(r, state.keyword, menus[r.sh.id] ?? '')) return false;
      return !budget || fitsBudget(menus[r.sh.id] ?? '', budget) !== false;
    });
    const sorted = sortRows(kept, state.sort) as Row[];
    if (!dish.size && !budget) return sorted;
    const score = (r: Row) => {
      const text = menus[r.sh.id] ?? '';
      let s = 0;
      if (dish.size && [...dish].some((d) => findMenuItems(text, d, 1).length)) s += 2;
      if (budget && fitsBudget(text, budget) === true) s += 1;
      return s;
    };
    const scored = sorted.map((r, i) => ({ r, i, s: score(r) }));
    scored.sort((a, b) => b.s - a.s || a.i - b.i);
    return scored.map((x) => x.r);
  }, [rows, menus, state.filters, state.sort, state.keyword]);
}
