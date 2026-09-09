import { useMemo } from 'react';
import {
  feasibility,
  nowMin,
  passFilter,
  pickTravel,
  sortRows,
  tierOf,
  toMin,
  todayKey,
  travelOf,
} from '@lunch-map/shared';
import type { Config, Feasibility, Parking, Shop } from '@lunch-map/shared';
import type { ComputedRow } from '@lunch-map/shared';
import { useFilters, type UiState } from '../state/FiltersContext.js';

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
}

function departWindow(state: UiState, cfg: Config) {
  const isToday = state.day === todayKey();
  if (state.useNow && isToday) {
    const n = nowMin();
    return { s: n, e: n };
  }
  return { s: toMin(cfg.depart.start), e: toMin(cfg.depart.end) };
}

/** 對照原本的 computeAll():每家店算一次交通時間、可行性、評分、投票。 */
export function useComputedRows({ config, shops, parkings, ratings, votes }: Args): Row[] {
  const { state } = useFilters();

  return useMemo(() => {
    if (!config) return [];
    const dw = departWindow(state, config);

    return shops.map((sh): Row => {
      const t = travelOf(sh, parkings, config);
      const tier = tierOf(t, config);
      const pt = pickTravel(t, state.mode, config);

      let f: Feasibility;
      if (!pt) {
        f = { code: 'out_of_range', label: '超出範圍' };
      } else if (sh.hoursUnknown) {
        f = { code: 'unknown', label: '營業時間未知', travelMin: pt.min };
      } else {
        f = feasibility(sh, state.day, pt.min, dw.s, dw.e, config);
      }

      const sc = ratings[sh.id] ?? { avg: 0, n: 0, who: {} };
      const voteTotal = votes[sh.id]?.total ?? 0;

      return {
        sh,
        t,
        tier,
        by: pt?.by ?? null,
        f,
        sc,
        votes: voteTotal,
        feasible: f.code === 'ok' || f.code === 'tight',
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- state.filters/state.sort intentionally excluded, only day/mode/useNow affect row computation
  }, [config, shops, parkings, ratings, votes, state.day, state.mode, state.useNow]);
}

/** 篩選 + 排序過的可見清單 —— 給地圖跟清單共用同一份順序。 */
export function useVisibleRows(rows: Row[]): Row[] {
  const { state } = useFilters();
  return useMemo(
    () => sortRows(rows.filter((r) => passFilter(r, state.filters)), state.sort) as Row[],
    [rows, state.filters, state.sort],
  );
}
