import assert from 'node:assert/strict';
import { test } from 'node:test';
import { expandDays, parseOsmHours } from './osmHours.js';

test('expandDays expands a day range', () => {
  assert.deepEqual(expandDays('Mo-Fr'), ['mon', 'tue', 'wed', 'thu', 'fri']);
});

test('expandDays handles a comma list mixing ranges and single days', () => {
  assert.deepEqual(expandDays('Mo-We,Fr'), ['mon', 'tue', 'wed', 'fri']);
});

test('expandDays returns null for an unrecognized token like PH', () => {
  assert.equal(expandDays('Mo-Fr,PH'), null);
});

test('parseOsmHours handles 24/7', () => {
  const h = parseOsmHours('24/7');
  assert.deepEqual(h?.mon, [['00:00', '24:00']]);
  assert.deepEqual(h?.sun, [['00:00', '24:00']]);
});

test('parseOsmHours handles a simple weekday rule plus a weekend "off"', () => {
  const h = parseOsmHours('Mo-Fr 11:00-14:00,17:00-21:00; Sa,Su off');
  assert.deepEqual(h?.mon, [['11:00', '14:00'], ['17:00', '21:00']]);
  assert.deepEqual(h?.sat, []);
  assert.deepEqual(h?.sun, []);
});

test('parseOsmHours returns null for a string it cannot parse', () => {
  assert.equal(parseOsmHours('Mo-Fr sunrise-sunset'), null);
  assert.equal(parseOsmHours(''), null);
});
