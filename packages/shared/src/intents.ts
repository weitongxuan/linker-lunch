import { CATALOGUE, SLOT_TEMPLATES, UNKNOWN_REPLY } from './intentCatalogue.js';
import type { IntentActions } from './intentCatalogue.js';

export { CATALOGUE, SLOT_TEMPLATES, UNKNOWN_REPLY } from './intentCatalogue.js';
export type { IntentActions, CatalogueEntry } from './intentCatalogue.js';

export type Intent =
  | { kind: 'matched'; label: string; reply: string; actions: IntentActions }
  | { kind: 'unknown'; reply: string; suggestions: string[] };

/** 給使用者看的例句:兩句帶類別槽位的 + 每個意圖的代表句 */
export const EXAMPLE_QUESTIONS = ['我今天不想吃便當', '想吃麵', ...CATALOGUE.map((e) => e.examples[0])];

/** 目錄裡所有問法展開後的總數(含類別槽位 × 類別),給測試與交接用 */
export function catalogueSize(categories: string[]): number {
  const slot = (SLOT_TEMPLATES.exclude.length + SLOT_TEMPLATES.include.length) * categories.length;
  return CATALOGUE.reduce((n, e) => n + e.examples.length, 0) + slot;
}

const NEGATE = ['不想吃', '不要吃', '不吃', '不要', '吃膩', '膩了', '別吃', '不想', '吃到怕', '吃怕', '別再', '拒絕', '以外', '除了'];

const CAT_ALIAS: Record<string, string> = {
  拉麵: '麵', 麵食: '麵', 麵條: '麵', 義大利麵: '麵', 乾麵: '麵', 湯麵: '麵', 烏龍麵: '麵', 米粉: '麵',
  炒飯: '飯', 燴飯: '飯', 丼: '飯', 咖哩: '飯', 白飯: '飯', 燒臘: '飯', 排骨飯: '飯',
  餃子: '水餃', 湯包: '水餃', 鍋貼: '水餃',
  鍋物: '火鍋', 涮涮鍋: '火鍋', 鍋: '火鍋', 麻辣鍋: '火鍋',
  海產: '海鮮', 熱炒: '海鮮', 魚: '海鮮', 蝦: '海鮮',
  漢堡: '速食', 披薩: '速食', pizza: '速食', 炸雞: '速食', 薯條: '速食',
  飯盒: '便當', 快餐: '自助餐', 自助: '自助餐',
  咖啡: '甜點', 咖啡廳: '甜點', 甜食: '甜點', 下午茶: '甜點', 甜的: '甜點', 蛋糕: '甜點',
  牛排: '牛排', 排餐: '牛排',
};

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[\s，,。．.！!？?、;；:：~～'"「」『』()（）]/g, '');
}

function hit(text: string, words: string[]): boolean {
  return words.some((w) => text.includes(w.toLowerCase()));
}

/** 字元 bigram 的 Dice 相似度 0~1,抓「差不多的問法」 */
export function similarity(a: string, b: string): number {
  const grams = (s: string) => {
    const g = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const k = s.slice(i, i + 2);
      g.set(k, (g.get(k) ?? 0) + 1);
    }
    return g;
  };
  const ga = grams(a);
  const gb = grams(b);
  if (!ga.size || !gb.size) return 0;
  let inter = 0;
  for (const [k, n] of ga) inter += Math.min(n, gb.get(k) ?? 0);
  const total = [...ga.values()].reduce((x, y) => x + y, 0) + [...gb.values()].reduce((x, y) => x + y, 0);
  return (2 * inter) / total;
}

const SIMILARITY_THRESHOLD = 0.5;

function findCategories(text: string, categories: string[]): string[] {
  const found = new Set<string>();
  for (const c of [...categories].sort((a, b) => b.length - a.length)) {
    if (c && text.includes(c.toLowerCase())) found.add(c);
  }
  for (const [alias, cat] of Object.entries(CAT_ALIAS)) {
    if (text.includes(alias.toLowerCase()) && categories.includes(cat)) found.add(cat);
  }
  return [...found];
}

function unknown(): Intent {
  return { kind: 'unknown', reply: UNKNOWN_REPLY, suggestions: EXAMPLE_QUESTIONS };
}

export function parseIntent(input: string, categories: string[]): Intent {
  const text = normalizeText(input);
  if (!text) return unknown();

  const actions: IntentActions = {};
  const labels: string[] = [];
  const replies: string[] = [];

  // 1. 類別槽位
  const cats = findCategories(text, categories);
  if (cats.length) {
    const joined = cats.join('、');
    if (hit(text, NEGATE)) {
      actions.excludeCat = cats;
      labels.push(`不吃${joined}`);
      replies.push(`好,今天避開${joined}。這家如何:{shop}?`);
    } else {
      actions.cat = cats;
      labels.push(`想吃${joined}`);
      replies.push(`想吃${joined}嗎?推薦你:{shop}`);
    }
  }
  // 有動詞(想吃/不要…)卻對不到類別時不猜類別;句子照常往下走,讓目錄關鍵字有機會接手,
  // 例如「不要太貴」「不想開車」「今天吃好一點」。全部沒中才回 unknown。

  // 2. 目錄關鍵字(可疊加)
  for (const e of CATALOGUE) {
    if (hit(text, e.keywords)) {
      Object.assign(actions, e.actions);
      labels.push(e.label);
      replies.push(e.reply);
    }
  }

  // 3. 關鍵字全空:相似度兜底
  if (!labels.length) {
    let best: { reply: string; label: string; actions: IntentActions; s: number } | null = null;
    for (const e of CATALOGUE) {
      for (const ex of e.examples) {
        const s = similarity(text, normalizeText(ex));
        if (!best || s > best.s) best = { reply: e.reply, label: e.label, actions: e.actions, s };
      }
    }
    if (best && best.s >= SIMILARITY_THRESHOLD) {
      Object.assign(actions, best.actions);
      labels.push(best.label);
      replies.push(best.reply);
    }
  }

  if (!labels.length) return unknown();
  return { kind: 'matched', label: labels.join(' · '), reply: replies[replies.length - 1], actions };
}
