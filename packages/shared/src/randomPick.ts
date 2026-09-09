import { moodWeight } from './mood.js';
import type { ComputedRow } from './sort.js';
import type { Mood } from './types.js';

export interface WeightedRow {
  r: ComputedRow;
  w: number;
}

export type PickResult = { empty: true } | { empty?: false; row: ComputedRow; weights: WeightedRow[]; total: number };

/**
 * 加權隨機推薦。候選集合只能是 passFilter && feasible(ok/tight)的店 —— unknown 的店
 * 不會被抽到。權重從 1 開始依序疊乘:
 *   1) 評分基準:有人評過用平均分,沒人評過退回 Google 評分,都沒有就當 3(中性)分
 *   2) (base/3)^2 —— 用平方放大高分/低分的差距
 *   3) 評分人數信心加成:最多採計 5 人,每人 +6%
 *   4) tight(得晚點出門)降權 ×0.6
 *   5) 大盤心情加權(見 mood.ts)
 * 最終權重下限 0.05,不會有人是絕對抽不到的。
 */
export function randomPick(
  pool: ComputedRow[],
  mood: Mood | null,
  rng: () => number = Math.random,
): PickResult {
  if (!pool.length) return { empty: true };

  const weights: WeightedRow[] = pool.map((r) => {
    let w = 1;
    const base = r.sc.n ? r.sc.avg : r.sh.googleRating != null ? r.sh.googleRating : 3;
    w *= (base / 3) ** 2;
    w *= 1 + Math.min(r.sc.n, 5) * 0.06;
    if (r.f.code === 'tight') w *= 0.6;
    w *= moodWeight(r.sh, mood);
    return { r, w: Math.max(0.05, w) };
  });

  const total = weights.reduce((s, x) => s + x.w, 0);
  let x = rng() * total;
  for (const it of weights) {
    x -= it.w;
    if (x <= 0) return { row: it.r, weights, total };
  }
  return { row: weights[weights.length - 1].r, weights, total };
}
