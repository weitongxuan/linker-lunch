import { findMenuItems, haversine, openNowState, tierOf, travelOf, walkMinFor } from '@lunch-map/shared';
import type { AfterPlace, Config, DayKey, LatLng, Parking } from '@lunch-map/shared';

export interface DrinkPick {
  d: AfterPlace;
  /** 走路分鐘:有午餐店時是從午餐店走過去,否則從公司 */
  walk: number;
  open: ReturnType<typeof openNowState>;
  hits: string[];
}

/**
 * 問問看講了飲品名:在飲料店菜單裡找有這杯的店,先挑現在有開的,再挑走路最近的。
 * 同時也抽了午餐的話,「最近」改成離那家午餐店最近 —— 飲料通常是吃完順路買回公司。
 * 候選一樣只收公司附近(飲料的開車上限內)的店。一家都沒有這杯就回空陣列,不硬推沒賣的。
 */
export function rankDrinks(
  drinks: AfterPlace[],
  menus: Record<string, string>,
  wanted: string[],
  parkings: Parking[],
  config: Config,
  day: DayKey,
  nowMinute: number,
  near?: LatLng,
): DrinkPick[] {
  const rank = { open: 0, later: 1, unknown: 2, closed: 3, out_of_range: 4 } as const;
  return drinks
    .map((d) => {
      const t = travelOf(d, parkings, config);
      const hits = [...new Set(wanted.flatMap((w) => findMenuItems(menus[d.id] ?? '', w, 2)))].slice(0, 3);
      const walk = near ? walkMinFor(haversine(near, d), config) : t.walk;
      return { d, walk, tier: tierOf(t, config, config.maxDrinkDriveMin), open: openNowState(d, day, nowMinute), hits };
    })
    .filter((c) => c.tier !== 'far' && c.hits.length > 0)
    .sort((a, b) => rank[a.open.code] - rank[b.open.code] || a.walk - b.walk)
    .map(({ d, walk, open, hits }) => ({ d, walk, open, hits }));
}
