import assert from 'node:assert/strict';
import { test } from 'node:test';
import { daysSinceEaten } from './eaten.js';

test('returns null when never eaten', () => {
  assert.equal(daysSinceEaten([]), null);
});

test('returns the smallest day-diff among multiple dates', () => {
  const now = new Date(2026, 8, 8); // 2026-09-08
  const result = daysSinceEaten(['2026-09-01', '2026-09-06', '2026-08-20'], now);
  assert.equal(result, 2);
});

test('returns 0 for eaten today', () => {
  const now = new Date(2026, 8, 8);
  assert.equal(daysSinceEaten(['2026-09-08'], now), 0);
});
