import test from 'node:test';
import assert from 'node:assert/strict';
import { countMenuItems, findMenuItems, fitsBudget, itemMinPrice, parseMenu, splitMenuItem } from './menu.js';

const MENU = `【主食類】(小/大)
豬油乾麵 50/60
餛飩湯麵 70/80
【切仔類】
冷筍沙拉(4–10月限定) 160
魚腰 70
(以上價格均另加 10% 服務費)
【熱飲】
紅茶牛奶 30`;

test('分類、品項、附註分開', () => {
  const s = parseMenu(MENU);
  assert.deepEqual(s.map((x) => x.title), ['【主食類】(小/大)', '【切仔類】', '【熱飲】']);
  assert.deepEqual(s[1].items, ['冷筍沙拉(4–10月限定) 160', '魚腰 70']);
  assert.deepEqual(s[1].notes, ['(以上價格均另加 10% 服務費)']);
});

test('項數不算標題也不算附註', () => assert.equal(countMenuItems(MENU), 5));

test('沒有分類標題的菜單也能解析', () => {
  const s = parseMenu('排骨飯 90\n雞腿飯 100\n');
  assert.equal(s.length, 1);
  assert.equal(s[0].title, null);
  assert.equal(countMenuItems('排骨飯 90\n\n雞腿飯 100'), 2);
});

test('空字串 → 沒有分類、0 項', () => {
  assert.deepEqual(parseMenu(''), []);
  assert.equal(countMenuItems(''), 0);
});

test('拆品名與價格', () => {
  assert.deepEqual(splitMenuItem('豬油乾麵 50/60'), { name: '豬油乾麵', price: '50/60' });
  assert.deepEqual(splitMenuItem('加麵 +10'), { name: '加麵', price: '+10' });
  assert.deepEqual(splitMenuItem('咖哩雞塊便當 70(沒有菜、半碗飯)'), { name: '咖哩雞塊便當', price: '70(沒有菜、半碗飯)' });
  assert.deepEqual(splitMenuItem('生魚片 時價'), { name: '生魚片', price: '時價' });
  assert.deepEqual(splitMenuItem('鴨心 (未標價)'), { name: '鴨心 (未標價)', price: null });
  assert.deepEqual(splitMenuItem('冷筍沙拉(4–10月限定) 160'), { name: '冷筍沙拉(4–10月限定)', price: '160' });
});

test('找菜名:忽略空白與括號,最多 limit 行', () => {
  const m = '【麵】\n紅燒牛肉麵 150\n清燉牛肉 麵 160\n牛肉湯 120\n陽春麵 50';
  assert.deepEqual(findMenuItems(m, '牛肉麵'), ['紅燒牛肉麵 150', '清燉牛肉 麵 160']);
  assert.deepEqual(findMenuItems(m, '麵', 2), ['紅燒牛肉麵 150', '清燉牛肉 麵 160']);
  assert.deepEqual(findMenuItems(m, '拉麵'), []);
  assert.deepEqual(findMenuItems(m, ''), []);
});

test('品項最低價:取小份,加購不算', () => {
  assert.equal(itemMinPrice('豬油乾麵 50/60'), 50);
  assert.equal(itemMinPrice('加麵 +10'), null);
  assert.equal(itemMinPrice('鴨心'), null);
  assert.equal(itemMinPrice('咖哩便當 70(半碗飯)'), 70);
});

test('預算:預算內至少 3 道才算;價格太少回 null(不知道)', () => {
  const cheap = '陽春麵 40\n乾麵 45\n餛飩湯 50\n牛肉麵 150';
  const pricey = '牛排 380\n豬排 320\n雞排 280\n白飯 15';
  assert.equal(fitsBudget(cheap, 100), true);
  assert.equal(fitsBudget(pricey, 100), false);
  assert.equal(fitsBudget('紅茶\n綠茶', 100), null);
  assert.equal(fitsBudget('滷蛋 15\n貢丸湯 30', 100), null);
});
