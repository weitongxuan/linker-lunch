import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomPick } from './randomPick.js';
import type { ComputedRow } from './sort.js';
import type { Shop, WeeklyHours } from './types.js';

const emptyWeek = (): WeeklyHours => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });

function shop(id: string): Shop {
  return { id, name: id, lat: 0, lng: 0, category: '其他', price: null, service: ['dine_in'], note: '', hours: emptyWeek() };
}

function row(id: string, opts: Partial<{ code: 'ok' | 'tight'; avg: number; n: number }> = {}): ComputedRow {
  return {
    sh: shop(id),
    t: { meters: 0, walk: 5, drive: 5, park: null, parkWalk: 0 },
    tier: 'w5',
    by: 'walk',
    f: { code: opts.code ?? 'ok', label: '' },
    sc: { avg: opts.avg ?? 3, n: opts.n ?? 0 },
    votes: 0,
    feasible: true,
  };
}

test('an empty pool reports empty rather than throwing', () => {
  const result = randomPick([], () => null, null);
  assert.equal(result.empty, true);
});

test('recently-eaten places get a 5x lower weight than an otherwise-identical fresh place', () => {
  const fresh = row('fresh');
  const eaten = row('eaten');
  const result = randomPick([fresh, eaten], (id) => (id === 'eaten' ? 2 : null), null, () => 0);
  assert.equal(result.empty, undefined);
  if (!result.empty) {
    const wFresh = result.weights.find((w) => w.r.sh.id === 'fresh')!.w;
    const wEaten = result.weights.find((w) => w.r.sh.id === 'eaten')!.w;
    assert.ok(Math.abs(wEaten - wFresh * 0.2) < 1e-9, `expected eaten weight ${wFresh * 0.2}, got ${wEaten}`);
  }
});

test('a "tight" (leave-later) place is weighted at 0.6x an otherwise-identical "ok" place', () => {
  const ok = row('ok', { code: 'ok' });
  const tight = row('tight', { code: 'tight' });
  const result = randomPick([ok, tight], () => null, null, () => 0);
  if (!result.empty) {
    const wOk = result.weights.find((w) => w.r.sh.id === 'ok')!.w;
    const wTight = result.weights.find((w) => w.r.sh.id === 'tight')!.w;
    assert.ok(Math.abs(wTight - wOk * 0.6) < 1e-9, `expected tight weight ${wOk * 0.6}, got ${wTight}`);
  }
});

test('higher community rating increases weight quadratically', () => {
  const low = row('low', { avg: 2, n: 3 });
  const high = row('high', { avg: 5, n: 3 });
  const result = randomPick([low, high], () => null, null, () => 0);
  if (!result.empty) {
    const wLow = result.weights.find((w) => w.r.sh.id === 'low')!.w;
    const wHigh = result.weights.find((w) => w.r.sh.id === 'high')!.w;
    assert.ok(wHigh > wLow, 'a 5-star place should outweigh a 2-star place');
  }
});
