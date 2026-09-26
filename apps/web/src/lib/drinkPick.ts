import { findMenuItems, openNowState, tierOf, travelOf } from '@lunch-map/shared';
import type { AfterPlace, Config, DayKey, Parking } from '@lunch-map/shared';

export interface DrinkPick {
  d: AfterPlace;
  walk: number;
  open: ReturnType<typeof openNowState>;
  hits: string[];
}

/**
 * 問問看講了飲品名:在飲料店菜單裡找有這杯的店,先挑現在有開的,再挑走路最近的。
 * 一家都沒有這杯就回 null,不要硬推一家沒賣的。
 */
export function pickDrink(
  drinks: AfterPlace[],
  menus: Record<string, string>,
  wanted: string[],
  parkings: Parking[],
  config: Config,
  day: DayKey,
  nowMinute: number,
): DrinkPick | null {
  const rank = { open: 0, later: 1, unknown: 2, closed: 3, out_of_range: 4 } as const;
  const cands = drinks
    .map((d) => {
      const t = travelOf(d, parkings, config);
      const hits = [...new Set(wanted.flatMap((w) => findMenuItems(menus[d.id] ?? '', w, 2)))].slice(0, 3);
      return { d, t, tier: tierOf(t, config, config.maxDrinkDriveMin), open: openNowState(d, day, nowMinute), hits };
    })
    .filter((c) => c.tier !== 'far' && c.hits.length > 0)
    .sort((a, b) => rank[a.open.code] - rank[b.open.code] || a.t.walk - b.t.walk);
  const best = cands[0];
  return best ? { d: best.d, walk: best.t.walk, open: best.open, hits: best.hits } : null;
}
