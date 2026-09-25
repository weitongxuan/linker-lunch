import test from 'node:test';
import assert from 'node:assert/strict';
import { countMenuItems, parseMenu, splitMenuItem } from './menu.js';

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
