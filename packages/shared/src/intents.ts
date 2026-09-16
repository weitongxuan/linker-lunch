import { CATALOGUE, SLOT_TEMPLATES, UNKNOWN_REPLY } from './intentCatalogue.js';
import type { IntentActions } from './intentCatalogue.js';

export { CATALOGUE, SLOT_TEMPLATES, UNKNOWN_REPLY } from './intentCatalogue.js';
export type { IntentActions, CatalogueEntry } from './intentCatalogue.js';

export interface IntentCandidate {
  id: string;
  question: string;
  label: string;
  reply: string;
  actions: IntentActions;
}

export type Intent =
  | { kind: 'matched'; label: string; reply: string; actions: IntentActions }
  | { kind: 'unknown'; reply: string; suggestions: string[]; candidates: IntentCandidate[] };

export const EXAMPLE_QUESTIONS = ['我今天不想吃便當', '想吃日式但不要拉麵', ...CATALOGUE.map((e) => e.examples[0])];

/** 目錄裡所有問法展開後的總數(類別與菜系槽位各 × 詞彙數),給測試與交接用 */
export function catalogueSize(categories: string[], cuisines: string[] = []): number {
  const cat = (SLOT_TEMPLATES.exclude.length + SLOT_TEMPLATES.include.length) * categories.length;
  const cui = (SLOT_TEMPLATES.excludeCuisine.length + SLOT_TEMPLATES.includeCuisine.length) * cuisines.length;
  return CATALOGUE.reduce((n, e) => n + e.examples.length, 0) + cat + cui;
}

/** 一句話裡哪些字代表「不要」 */
const NEGATE = ['不想吃', '不要吃', '不吃', '不要', '不想', '別吃', '別再', '拒絕', '吃到怕', '吃膩', '膩了', '吃怕', '除了', '以外'];
/** 其中放在名詞「前面」的那些,句子會在它們之前切開;「麵吃膩了」這種後置的不切,否則名詞會落到中性子句 */
const NEGATE_PREFIX = ['不想吃', '不要吃', '不吃', '不要', '不想', '別吃', '別再', '拒絕', '除了'];
/** 子句分隔:標點與轉折連接詞 */
const CONNECTIVES = ['但是', '不過', '然後', '還有', '以及', '另外', '順便', '而且', '但'];
const SEPARATORS = /[,，、;；。.!！?？~～]/g;

const CAT_ALIAS: Record<string, string> = {
  拉麵: '麵', 麵食: '麵', 麵條: '麵', 義大利麵: '麵', 乾麵: '麵', 湯麵: '麵', 烏龍麵: '麵', 米粉: '麵',
  炒飯: '飯', 燴飯: '飯', 丼: '飯', 咖哩: '飯', 白飯: '飯', 燒臘: '飯', 排骨飯: '飯',
  餃子: '水餃', 湯包: '水餃', 鍋貼: '水餃',
  鍋物: '火鍋', 涮涮鍋: '火鍋', 鍋: '火鍋', 麻辣鍋: '火鍋',
  海產: '海鮮', 熱炒: '海鮮', 魚: '海鮮', 蝦: '海鮮',
  漢堡: '速食', 披薩: '速食', pizza: '速食', 炸雞: '速食', 薯條: '速食',
  飯盒: '便當', 快餐: '自助餐', 自助: '自助餐',
  咖啡: '甜點', 咖啡廳: '甜點', 甜食: '甜點', 下午茶: '甜點', 甜的: '甜點', 蛋糕: '甜點',
  排餐: '牛排',
};

const CUISINE_ALIAS: Record<string, string> = {
  日本: '日式', 日料: '日式', 日本料理: '日式', 和食: '日式',
  韓國: '韓式', 韓國菜: '韓式',
  泰國: '泰式', 泰國菜: '泰式',
  香港: '港式', 港點: '港式',
  義大利: '義式', 意大利: '義式',
  美國: '美式',
  越南: '越式',
  中國: '中式', 中華: '中式', 中菜: '中式',
  西餐: '西式', 歐式: '西式', 歐陸: '西式',
  蔬食: '素食', 吃素: '素食',
  台灣: '台式', 台菜: '台式',
  四川: '川菜',
  福建: '閩菜',
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
const DEFAULT_CANDIDATE_IDS = ['any', 'cheap', 'walk'];

export function rankCandidates(text: string, limit = 3): IntentCandidate[] {
  const scored = CATALOGUE.map((e) => ({ e, s: Math.max(...e.examples.map((ex) => similarity(text, normalizeText(ex)))) }))
    .sort((a, b) => b.s - a.s);
  const meaningful = scored.filter((x) => x.s >= 0.2).slice(0, limit);
  const picked = meaningful.length ? meaningful.map((x) => x.e) : DEFAULT_CANDIDATE_IDS.map((id) => CATALOGUE.find((e) => e.id === id)!);
  return picked.map((e) => ({ id: e.id, question: e.question, label: e.label, reply: e.reply, actions: e.actions }));
}

/**
 * 把一句話切成子句:先在標點與轉折詞處切,再在每個「不要/不想…」前切開,
 * 這樣「想吃麵或飯不要便當」會變成 ["想吃麵或飯", "不要便當"],各自判方向。
 */
function splitClauses(raw: string): string[] {
  let t = raw.toLowerCase().replace(/[\s'"「」『』()（）:：]/g, '');
  t = t.replace(SEPARATORS, '|');
  for (const w of [...CONNECTIVES].sort((a, b) => b.length - a.length)) t = t.split(w).join('|');
  for (const w of [...NEGATE_PREFIX].sort((a, b) => b.length - a.length)) t = t.split(w).join('|' + w);
  return t.split('|').map((c) => c.trim()).filter(Boolean);
}

function findTerms(text: string, vocab: string[], alias: Record<string, string>): string[] {
  const found = new Set<string>();
  for (const v of [...vocab].sort((a, b) => b.length - a.length)) if (v && text.includes(v.toLowerCase())) found.add(v);
  for (const [a, v] of Object.entries(alias)) if (text.includes(a.toLowerCase()) && vocab.includes(v)) found.add(v);
  return [...found];
}

function unknown(text: string): Intent {
  return { kind: 'unknown', reply: UNKNOWN_REPLY, suggestions: EXAMPLE_QUESTIONS, candidates: rankCandidates(text) };
}

export function parseIntent(input: string, categories: string[], cuisines: string[] = []): Intent {
  const whole = normalizeText(input);
  if (!whole) return unknown(whole);

  // 1. 子句 → 想吃/不想吃 × 類別/菜系;同一項同時出現時「不吃」優先
  const wantCat = new Set<string>(), noCat = new Set<string>(), wantCui = new Set<string>(), noCui = new Set<string>();
  for (const clause of splitClauses(input)) {
    const exclude = hit(clause, NEGATE);
    for (const c of findTerms(clause, categories, CAT_ALIAS)) (exclude ? noCat : wantCat).add(c);
    for (const c of findTerms(clause, cuisines, CUISINE_ALIAS)) (exclude ? noCui : wantCui).add(c);
  }
  for (const c of noCat) wantCat.delete(c);
  for (const c of noCui) wantCui.delete(c);

  const actions: IntentActions = {};
  const labels: string[] = [];
  if (wantCat.size) { actions.cat = [...wantCat]; labels.push(`想吃${[...wantCat].join('、')}`); }
  if (wantCui.size) { actions.cuisine = [...wantCui]; labels.push(`想吃${[...wantCui].join('、')}`); }
  if (noCat.size) { actions.excludeCat = [...noCat]; labels.push(`不吃${[...noCat].join('、')}`); }
  if (noCui.size) { actions.excludeCuisine = [...noCui]; labels.push(`不吃${[...noCui].join('、')}`); }
  const slotParts = labels.length;

  // 2. 目錄關鍵字(可疊加)
  const condLabels: string[] = [];
  let lastReply: string | null = null;
  for (const e of CATALOGUE) {
    if (hit(whole, e.keywords)) {
      Object.assign(actions, e.actions);
      labels.push(e.label);
      condLabels.push(e.label);
      lastReply = e.reply;
    }
  }

  // 3. 都沒中才用相似度兜底
  if (!labels.length) {
    let best: { e: (typeof CATALOGUE)[number]; s: number } | null = null;
    for (const e of CATALOGUE) for (const ex of e.examples) {
      const s = similarity(whole, normalizeText(ex));
      if (!best || s > best.s) best = { e, s };
    }
    if (best && best.s >= SIMILARITY_THRESHOLD) {
      Object.assign(actions, best.e.actions);
      labels.push(best.e.label);
      lastReply = best.e.reply;
    }
  }
  if (!labels.length) return unknown(whole);

  // 4. 回答句:有槽位就組句,否則用目錄那句
  let reply: string;
  if (slotParts) {
    const want = [...wantCui, ...wantCat];
    const avoid = [...noCui, ...noCat];
    const bits = [want.length ? `想吃${want.join('、')}` : '', avoid.length ? `避開${avoid.join('、')}` : ''].filter(Boolean).join(',');
    const cond = condLabels.length ? `,${condLabels.join('、')}` : '';
    reply = `好,${bits}${cond} —— 這家如何:{shop}?`;
  } else {
    reply = lastReply ?? '那就交給運氣:{shop}!';
  }
  return { kind: 'matched', label: labels.join(' · '), reply, actions };
}
