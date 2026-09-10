import test from 'node:test';
import assert from 'node:assert/strict';
import { parseIntent, similarity } from './intents.js';

const CATS = ['便當', '其他', '小吃', '水餃', '海鮮', '火鍋', '牛排', '自助餐', '速食', '飯', '麵', '甜點'];
const m = (q: string) => {
  const r = parseIntent(q, CATS);
  assert.equal(r.kind, 'matched', `應該要聽懂:${q}`);
  return r.kind === 'matched' ? r : (assert.fail() as never);
};

test('不想吃便當 → 排除便當,回答帶 {shop}', () => {
  const r = m('我今天不想吃便當');
  assert.deepEqual(r.actions.excludeCat, ['便當']);
  assert.match(r.reply, /避開便當.*\{shop\}/);
});
test('改寫也懂:便當吃到怕了', () => assert.deepEqual(m('便當吃到怕了').actions.excludeCat, ['便當']));
test('想吃拉麵 → 別名對到 麵', () => assert.deepEqual(m('想吃拉麵！').actions.cat, ['麵']));
test('複合:不想吃便當 便宜 走路', () => {
  const r = m('不想吃便當,便宜一點,走路就好');
  assert.deepEqual(r.actions.excludeCat, ['便當']);
  assert.equal(r.actions.mood, 'down');
  assert.equal(r.actions.mode, 'walk');
});
test('口袋沒什麼錢 → 省一點', () => assert.equal(m('口袋沒什麼錢').actions.mood, 'down'));
test('幫我決定 → 只抽', () => assert.deepEqual(m('幫我決定').actions, {}));
test('相似度兜底:差不多的問法', () => {
  assert.ok(similarity('不知道吃什麼', '不知道要吃什麼') > 0.5);
  assert.equal(m('今天不知道要吃什麼').label, '隨便推薦');
});
test('聽不懂 → unknown 帶回覆與例句', () => {
  const r = parseIntent('今天天氣真好', CATS);
  assert.equal(r.kind, 'unknown');
  if (r.kind === 'unknown') assert.ok(r.suggestions.length >= 7);
});
test('有動詞但類別對不到 → 不亂猜', () => assert.equal(parseIntent('不想吃西班牙菜', CATS).kind, 'unknown'));
