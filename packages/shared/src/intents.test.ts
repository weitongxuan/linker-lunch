import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, similarity } from './intents.js';

const CATS = ['便當', '其他', '小吃', '水餃', '海鮮', '火鍋', '牛排', '自助餐', '速食', '飯', '麵', '甜點'];
const CUIS = ['台式', '日式', '港式', '泰式', '韓式', '義式', '美式', '越式', '川菜', '閩菜', '中式', '西式', '素食'];
const m = (q: string) => {
  const r = parseIntent(q, CATS, CUIS);
  assert.equal(r.kind, 'matched', `應該要聽懂:${q}`);
  return r.kind === 'matched' ? r : (assert.fail() as never);
};

test('不想吃便當 → 排除便當', () => assert.deepEqual(m('我今天不想吃便當').actions.excludeCat, ['便當']));
test('想吃拉麵 → 別名對到 麵', () => assert.deepEqual(m('想吃拉麵！').actions.cat, ['麵']));
test('複合:想吃麵或飯,不要便當,便宜', () => {
  const r = m('想吃麵或飯,不要便當,便宜一點');
  assert.deepEqual(new Set(r.actions.cat), new Set(['麵', '飯']));
  assert.deepEqual(r.actions.excludeCat, ['便當']);
  assert.equal(r.actions.mood, 'down');
  assert.match(r.reply, /想吃.*避開便當.*省一點/);
});
test('菜系:想吃日式但不要拉麵', () => {
  const r = m('想吃日式但不要拉麵');
  assert.deepEqual(r.actions.cuisine, ['日式']);
  assert.deepEqual(r.actions.excludeCat, ['麵']);
  assert.equal(r.actions.cat, undefined);
});
test('菜系別名:日本料理 → 日式;不要泰國菜 → 排除泰式', () => {
  assert.deepEqual(m('想吃日本料理').actions.cuisine, ['日式']);
  assert.deepEqual(m('今天不要泰國菜').actions.excludeCuisine, ['泰式']);
});
test('同項同時出現 → 不吃優先', () => {
  const r = m('想吃麵 但不要麵');
  assert.equal(r.actions.cat, undefined);
  assert.deepEqual(r.actions.excludeCat, ['麵']);
});
test('口袋沒什麼錢 → 省一點', () => assert.equal(m('口袋沒什麼錢').actions.mood, 'down'));
test('相似度兜底', () => {
  assert.ok(similarity('不知道吃什麼', '不知道要吃什麼') > 0.5);
  assert.equal(m('今天不知道要吃什麼').label, '隨便推薦');
});
test('聽不懂 → unknown 帶 3 候選', () => {
  const r = parseIntent('今天天氣真好', CATS, CUIS);
  assert.equal(r.kind, 'unknown');
  if (r.kind === 'unknown') assert.equal(r.candidates.length, 3);
});
test('有動詞但對不到 → 不亂猜', () => assert.equal(parseIntent('不想吃西班牙菜', CATS, CUIS).kind, 'unknown'));
