import assert from 'node:assert/strict';
import { test } from 'node:test';
import { haversine, pickTravel } from './travel.js';
import type { Config, Travel } from './types.js';

const CFG: Config = {
  office: { lat: 22.6208, lng: 120.2772, name: '辦公室' },
  eatMinutes: 25,
  priceBands: [],
  walkSpeed: 80,
  detour: 1.25,
  maxWalkMin: 10,
  driveSpeed: 400,
  parkSearch: 3,
  streetSearch: 6,
  driveWorthIt: 5,
  maxDriveMin: 15,
};

test('haversine returns ~0 for identical points and a sane value for a known offset', () => {
  const a = { lat: 22.6208, lng: 120.2772 };
  assert.equal(haversine(a, a), 0);
  // roughly 0.01 deg lat ~ 1.1km
  const b = { lat: 22.6308, lng: 120.2772 };
  const d = haversine(a, b);
  assert.ok(d > 1000 && d < 1200, `expected ~1100m, got ${d}`);
});

test('pickTravel prefers walking unless driving saves at least driveWorthIt minutes', () => {
  const t: Travel = { meters: 0, walk: 8, drive: 5, park: null, parkWalk: 0 }; // saves 3 min, under threshold
  assert.deepEqual(pickTravel(t, 'auto', CFG), { min: 8, by: 'walk' });

  const t2: Travel = { meters: 0, walk: 12, drive: 6, park: null, parkWalk: 0 }; // saves 6 min, over threshold
  assert.deepEqual(pickTravel(t2, 'auto', CFG), { min: 6, by: 'drive' });
});

test('pickTravel returns null (out of range) when forced mode exceeds its cap', () => {
  const t: Travel = { meters: 0, walk: 20, drive: 20, park: null, parkWalk: 0 };
  assert.equal(pickTravel(t, 'walk', CFG), null);
  assert.equal(pickTravel(t, 'drive', CFG), null);
});
