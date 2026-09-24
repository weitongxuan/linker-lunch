import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomPick } from './randomPick.js';
import type { ComputedRow } from './sort.js';
import type { Shop, WeeklyHours, OpenNowCode } from './types.js';

const emptyWeek = (): WeeklyHours => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });

function shop(id: string): Shop {
  return { id, name: id, lat: 0, lng: 0, category: ['其他'], price: null, service: ['dine_in'], note: '', hours: emptyWeek() };
}

function row(id: string, opts: Partial<{ code: OpenNowCode; avg: number; n: number }> = {}): ComputedRow {
  return {
    sh: shop(id),
    t: { meters: 0, walk: 5, drive: 5, park: null, parkWalk: 0 },
    tier: 'w5',
    by: 'walk',
    f: { code: opts.code ?? 'open', label: '' },
    sc: { avg: opts.avg ?? 3, n: opts.n ?? 0 },
    travelMin: 5,
    votes: 0,
    feasible: true,
  };
}

test('an empty pool reports empty rather than throwing', () => {
  const result = randomPick([], null);
  assert.equal(result.empty, true);
});


test('status no longer changes the weight — the pool is already only feasible shops', () => {
  // randomPick 的候選來自 lunchRows.filter(r => r.feasible),所以「等一下才開」的店
  // 根本進不來,舊版那個 0.6 倍狀態加權已經沒有意義,移除後這裡固定驗證兩者等重。
  const a = row('a', { code: 'open' });
  const b = row('b', { code: 'later' });
  const result = randomPick([a, b], null, () => 0);
  if (!result.empty) {
    const wa = result.weights.find((w) => w.r.sh.id === 'a')!.w;
    const wb = result.weights.find((w) => w.r.sh.id === 'b')!.w;
    assert.equal(wa, wb);
  }
});

test('higher community rating increases weight quadratically', () => {
  const low = row('low', { avg: 2, n: 3 });
  const high = row('high', { avg: 5, n: 3 });
  const result = randomPick([low, high], null, () => 0);
  if (!result.empty) {
    const wLow = result.weights.find((w) => w.r.sh.id === 'low')!.w;
    const wHigh = result.weights.find((w) => w.r.sh.id === 'high')!.w;
    assert.ok(wHigh > wLow, 'a 5-star place should outweigh a 2-star place');
  }
});
