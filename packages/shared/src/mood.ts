import type { AfterPlace, Market, Mood, Shop } from './types.js';

export const CHEAP_CAT = ['便當', '自助餐', '麵', '水餃', '小吃', '速食', '早餐'];
export const FANCY_CAT = ['牛排', '海鮮', '火鍋'];

export const MOOD_TABLE: Record<Mood, { label: string; hint: string; fancy: number; cheap: number }> = {
  up: { label: '加菜', hint: '貴一點', fancy: 2.2, cheap: 0.55 },
  flat: { label: '平盤', hint: '不影響', fancy: 1, cheap: 1 },
  down: { label: '省一點', hint: '便宜', fancy: 0.4, cheap: 2.2 },
};

/** 大盤指數漲跌 % -> 心情。門檻 ±0.3%。 */
export function moodFromPct(pct: number): Mood {
  if (pct >= 0.3) return 'up';
  if (pct <= -0.3) return 'down';
  return 'flat';
}

/** override 是使用者在篩選抽屜手動選的('auto' 表示跟著大盤走) */
export function currentMood(override: Mood | 'auto', market: Market | null): Mood | null {
  if (override !== 'auto') return override;
  if (!market) return null;
  return moodFromPct(market.pct);
}

export function priceTilt(place: Shop | AfterPlace): 'fancy' | 'cheap' | null {
  if (place.price != null) return place.price >= 3 ? 'fancy' : 'cheap';
  const category = 'category' in place ? place.category : undefined;
  if (category?.some((c) => FANCY_CAT.includes(c))) return 'fancy';
  if (category?.some((c) => CHEAP_CAT.includes(c))) return 'cheap';
  return null;
}

/** randomPick() 用的權重乘數:大盤影響推薦機率,不影響是否顯示/是否吃得到 */
export function moodWeight(place: Shop | AfterPlace, mood: Mood | null): number {
  if (!mood || mood === 'flat') return 1;
  const tilt = priceTilt(place);
  if (!tilt) return 1;
  return MOOD_TABLE[mood][tilt];
}
