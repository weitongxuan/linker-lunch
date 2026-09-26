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

// 第三層(相似度)的領先差距:兩個意圖一樣像就不猜,改反問
test('第三層分數接近 → ambiguous,候選含那兩個意圖', () => {
  const r = parseIntent('來個一點的', CATS, CUIS); // 走路 0.57 vs 趕時間 0.57
  assert.equal(r.kind, 'ambiguous');
  if (r.kind === 'ambiguous') {
    const ids = r.candidates.map((c) => c.id);
    assert.ok(ids.includes('walk') && ids.includes('quick'), ids.join(','));
    assert.ok(r.candidates.length <= 3);
  }
  const r2 = parseIntent('來個大一點的', CATS, CUIS); // fancy 0.50 vs walk 0.50
  assert.equal(r2.kind, 'ambiguous');
  if (r2.kind === 'ambiguous') assert.ok(r2.candidates.map((c) => c.id).includes('fancy'));
});
test('第三層明確領先 → 仍直接命中', () => {
  assert.equal(m('這家不喜歡').label, '換一家'); // again 0.75,第二名 0
  assert.equal(m('太貴的不要').actions.mood, 'down'); // cheap 0.57 vs good 0.29
  assert.equal(m('不想走遠').actions.mode, 'walk'); // walk 0.57 vs takeout 0.25
});
test('第三層最高分不到門檻 → 仍是 unknown,不是 ambiguous', () => assert.equal(parseIntent('肚子餓了', CATS, CUIS).kind, 'unknown'));

// 擴充後的意圖與別名
test('新意圖:外送 / 吃辣 / 不吃辣 / 請客 / 高評價', () => {
  assert.deepEqual(m('下雨不想出門').actions.service, ['delivery']);
  assert.deepEqual(m('想吃辣的').actions.cuisine, ['川菜', '泰式', '韓式']);
  assert.deepEqual(m('怕辣').actions.excludeCuisine, ['川菜']);
  assert.equal(m('不要辣的').actions.cuisine, undefined);
  const t = m('主管請客');
  assert.equal(t.actions.mood, 'up');
  assert.deepEqual(t.actions.service, ['dine_in']);
  assert.equal(m('最好吃的').actions.minGoogle, 4.3);
  assert.equal(m('最好吃的').label, 'Google 4.3 以上');
  const g = m('4.5以上又便宜的'); // 小數點不能把句子切開
  assert.equal(g.actions.minGoogle, 4.3);
  assert.equal(g.actions.mood, 'down');
});
test('別名:牛肉麵→麵、鹹酥雞→小吃、麥當勞→速食、小籠包→水餃', () => {
  assert.deepEqual(m('想吃牛肉麵').actions.cat, ['麵']);
  assert.deepEqual(m('不想吃鹹酥雞').actions.excludeCat, ['小吃']);
  assert.deepEqual(m('麥當勞').actions.cat, ['速食']);
  assert.deepEqual(m('想吃小籠包').actions.cat, ['水餃']);
});
test('新否定詞:不愛吃 / 就不用了 / 討厭', () => {
  assert.deepEqual(m('不愛吃便當').actions.excludeCat, ['便當']);
  assert.deepEqual(m('便當就不用了').actions.excludeCat, ['便當']);
  assert.deepEqual(m('討厭火鍋').actions.excludeCat, ['火鍋']);
});
test('吃素只算一次(槽位接住,不重複標籤)', () => {
  const r = m('今天吃素');
  assert.deepEqual(r.actions.cuisine, ['素食']);
  assert.equal(r.label, '想吃素食');
});

// 菜名與預算
test('菜名:想吃牛肉麵 → 類別麵 + 菜名牛肉麵,標籤用菜名', () => {
  const r = m('想吃牛肉麵');
  assert.deepEqual(r.actions.cat, ['麵']);
  assert.deepEqual(r.actions.dish, ['牛肉麵']);
  assert.match(r.label, /想吃牛肉麵/);
});
test('泛稱不算菜名:麵食、熱炒、鍋物', () => {
  assert.equal(m('想吃麵食').actions.dish, undefined);
  assert.equal(m('想吃熱炒').actions.dish, undefined);
});
test('不吃的菜名不算', () => {
  const r = m('不想吃牛肉麵');
  assert.equal(r.actions.dish, undefined);
  assert.deepEqual(r.actions.excludeCat, ['麵']);
});
test('預算:數字與中文', () => {
  assert.equal(m('100元以內').actions.budget, 100);
  assert.equal(m('兩百塊有找').actions.budget, 200);
  assert.equal(m('預算150左右的便當').actions.budget, 150);
  assert.equal(m('想吃牛肉麵 一百五以內').actions.budget, 150);
  assert.equal(m('想吃牛肉麵 一百五以內').actions.dish?.[0], '牛肉麵');
});
test('預算與其他條件疊加:便宜 + 走路 + 預算', () => {
  const r = m('走路到得了 80元以內 便宜的');
  assert.equal(r.actions.budget, 80);
  assert.equal(r.actions.mode, 'walk');
  assert.equal(r.actions.mood, 'down');
});
