import { useMemo } from 'react';
import { openNowState, passFilter, pickTravel, sortRows, tierOf, travelOf } from '@lunch-map/shared';
import type { Config, OpenNowState, Parking, Shop } from '@lunch-map/shared';
import type { ComputedRow } from '@lunch-map/shared';
import { useFilters } from '../state/FiltersContext.js';

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

function matchesKeyword(r: Row, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  const haystack = [r.sh.name, ...r.sh.category, r.sh.addr, r.sh.note].filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(kw);
}

/** 篩選 + 排序過的可見清單 —— 給地圖跟清單共用同一份順序。 */
export function useVisibleRows(rows: Row[]): Row[] {
  const { state } = useFilters();
  return useMemo(
    () =>
      sortRows(
        rows.filter((r) => passFilter(r, state.filters) && matchesKeyword(r, state.keyword)),
        state.sort,
      ) as Row[],
    [rows, state.filters, state.sort, state.keyword],
  );
}
