import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent } from './intents.js';

const CATS = ['便當', '其他', '小吃', '水餃', '海鮮', '火鍋', '牛排', '自助餐', '速食', '飯', '麵', '甜點'];

test('不想吃便當 → 排除便當', () => {
  const r = parseIntent('我今天不想吃便當', CATS);
  assert.equal(r.kind, 'matched');
  if (r.kind === 'matched') assert.deepEqual(r.actions.excludeCat, ['便當']);
});

test('想吃拉麵 → 別名對到 麵', () => {
  const r = parseIntent('想吃拉麵！', CATS);
  assert.equal(r.kind, 'matched');
  if (r.kind === 'matched') assert.deepEqual(r.actions.cat, ['麵']);
});

test('複合:不想吃便當 要便宜 走路', () => {
  const r = parseIntent('不想吃便當,便宜一點,走路就好', CATS);
  assert.equal(r.kind, 'matched');
  if (r.kind === 'matched') {
    assert.deepEqual(r.actions.excludeCat, ['便當']);
    assert.equal(r.actions.mood, 'down');
    assert.equal(r.actions.mode, 'walk');
  }
});

test('評價好的 → Google 4.0', () => {
  const r = parseIntent('評價好的', CATS);
  if (r.kind === 'matched') assert.equal(r.actions.minGoogle, 4.0); else assert.fail();
});

test('隨便 → 只抽不改篩選', () => {
  const r = parseIntent('隨便推薦一家', CATS);
  assert.equal(r.kind, 'matched');
  if (r.kind === 'matched') assert.deepEqual(r.actions, {});
});

test('聽不懂 → 回例句', () => {
  const r = parseIntent('今天天氣真好', CATS);
  assert.equal(r.kind, 'unknown');
});

test('有動詞但類別對不到 → 不亂猜', () => {
  assert.equal(parseIntent('不想吃西班牙菜', CATS).kind, 'unknown');
});
