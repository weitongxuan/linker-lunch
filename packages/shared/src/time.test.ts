import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fmt, toMin } from './time.js';

test('toMin parses HH:MM into minutes since midnight', () => {
  assert.equal(toMin('11:30'), 690);
  assert.equal(toMin('00:00'), 0);
  assert.equal(toMin('9:05'), 545);
});

test('fmt wraps negative and >1440 values before formatting', () => {
  assert.equal(fmt(690), '11:30');
  assert.equal(fmt(-30), '23:30');
  assert.equal(fmt(1500), '01:00');
});
