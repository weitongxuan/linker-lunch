import assert from 'node:assert/strict';
import { test } from 'node:test';
import { feasibility } from './feasibility.js';
import type { Config, Shop, WeeklyHours } from './types.js';

const CFG: Config = {
  office: { lat: 22.6208, lng: 120.2772, name: '辦公室' },
  depart: { start: '11:40', end: '11:40' },
  backBy: '13:00',
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

const emptyWeek = (): WeeklyHours => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });

function shopWith(hours: Partial<WeeklyHours>): Shop {
  return {
    id: 'x', name: '測試店', lat: 0, lng: 0, category: ['其他'], price: null,
    service: ['dine_in'], note: '', hours: { ...emptyWeek(), ...hours },
  };
}

const DEPART = { s: 700, e: 700 }; // 11:40

test('ok: plenty of overlap, shop already open before latest arrival', () => {
  const sh = shopWith({ mon: [['11:00', '14:00']] });
  const f = feasibility(sh, 'mon', 5, DEPART.s, DEPART.e, CFG);
  assert.equal(f.code, 'ok');
});

test('tight: shop opens after the latest possible arrival, so must leave later than usual', () => {
  const sh = shopWith({ mon: [['12:00', '13:00']] });
  const f = feasibility(sh, 'mon', 5, DEPART.s, DEPART.e, CFG);
  assert.equal(f.code, 'tight');
});

test('closed: empty hours for the day', () => {
  const sh = shopWith({ mon: [] });
  const f = feasibility(sh, 'mon', 5, DEPART.s, DEPART.e, CFG);
  assert.equal(f.code, 'closed');
});

test('not_lunch: only open for dinner, no overlap with the lunch window', () => {
  const sh = shopWith({ mon: [['18:00', '22:00']] });
  const f = feasibility(sh, 'mon', 5, DEPART.s, DEPART.e, CFG);
  assert.equal(f.code, 'not_lunch');
});

test('not_enough: overlap exists but shorter than eatMinutes', () => {
  const sh = shopWith({ mon: [['11:50', '12:05']] });
  const f = feasibility(sh, 'mon', 5, DEPART.s, DEPART.e, CFG);
  assert.equal(f.code, 'not_enough');
});

test('no_time: round-trip travel alone eats the whole lunch window', () => {
  const sh = shopWith({ mon: [['11:00', '14:00']] });
  const f = feasibility(sh, 'mon', 40, DEPART.s, DEPART.e, CFG);
  assert.equal(f.code, 'no_time');
});
