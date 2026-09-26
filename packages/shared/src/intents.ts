import { AMBIGUOUS_REPLY, CATALOGUE, SLOT_TEMPLATES, UNKNOWN_REPLY } from './intentCatalogue.js';
import type { CatalogueEntry, IntentActions } from './intentCatalogue.js';

export { AMBIGUOUS_REPLY, CATALOGUE, SLOT_TEMPLATES, UNKNOWN_REPLY } from './intentCatalogue.js';
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
  /** 第三層兩個意圖一樣像,不猜,反問;candidates 前幾個就是分數接近的那些 */
  | { kind: 'ambiguous'; reply: string; suggestions: string[]; candidates: IntentCandidate[] }
  | { kind: 'unknown'; reply: string; suggestions: string[]; candidates: IntentCandidate[] };

export const EXAMPLE_QUESTIONS = ['我今天不想吃便當', '想吃日式但不要拉麵', ...CATALOGUE.map((e) => e.examples[0])];

/** 目錄裡所有問法展開後的總數(類別與菜系槽位各 × 詞彙數),給測試與交接用 */
export function catalogueSize(categories: string[], cuisines: string[] = []): number {
  const cat = (SLOT_TEMPLATES.exclude.length + SLOT_TEMPLATES.include.length) * categories.length;
  const cui = (SLOT_TEMPLATES.excludeCuisine.length + SLOT_TEMPLATES.includeCuisine.length) * cuisines.length;
  return CATALOGUE.reduce((n, e) => n + e.examples.length, 0) + cat + cui;
}

/** 一句話裡哪些字代表「不要」 */
const NEGATE = ['不想吃', '不要吃', '不吃', '不要', '不想', '別吃', '別再', '拒絕', '吃到怕', '吃膩', '膩了', '吃怕', '除了', '以外', '不愛', '討厭', '不太想', '避開', '不敢吃', '不能吃', '不用了', '就不用'];
/** 其中放在名詞「前面」的那些,句子會在它們之前切開;「麵吃膩了」這種後置的不切,否則名詞會落到中性子句 */
const NEGATE_PREFIX = ['不想吃', '不要吃', '不吃', '不要', '不想', '別吃', '別再', '拒絕', '除了', '不愛', '討厭', '不太想', '避開', '不敢吃', '不能吃'];
/** 子句分隔:標點與轉折連接詞 */
const CONNECTIVES = ['但是', '不過', '然後', '還有', '以及', '另外', '順便', '而且', '但'];
/** 半形句點只在後面不是數字時才算分隔:「4.5以上」要留成一句,關鍵字 '4.5' 才對得到 */
const SEPARATORS = /[,，、;；。!！?？~～]|\.(?!\d)/g;
/** 長的先切,否則「但是」會被「但」先切開 */
const CONNECTIVES_BY_LEN = [...CONNECTIVES].sort((a, b) => b.length - a.length);
const NEGATE_PREFIX_BY_LEN = [...NEGATE_PREFIX].sort((a, b) => b.length - a.length);

const CAT_ALIAS: Record<string, string> = {
  拉麵: '麵', 麵食: '麵', 麵條: '麵', 義大利麵: '麵', 乾麵: '麵', 湯麵: '麵', 烏龍麵: '麵', 米粉: '麵',
  牛肉麵: '麵', 意麵: '麵', 陽春麵: '麵', 粄條: '麵', 河粉: '麵', 鍋燒麵: '麵', 涼麵: '麵', 炒麵: '麵', 麵線: '麵', 麵店: '麵',
  炒飯: '飯', 燴飯: '飯', 丼: '飯', 咖哩: '飯', 白飯: '飯', 燒臘: '飯', 排骨飯: '飯',
  滷肉飯: '飯', 雞肉飯: '飯', 鴨肉飯: '飯', 燒肉飯: '飯', 雞腿飯: '飯', 焢肉飯: '飯', 定食: '飯',
  餃子: '水餃', 湯包: '水餃', 鍋貼: '水餃', 小籠包: '水餃', 蒸餃: '水餃', 煎餃: '水餃',
  鍋物: '火鍋', 涮涮鍋: '火鍋', 鍋: '火鍋', 麻辣鍋: '火鍋', 火鍋店: '火鍋', 壽喜燒: '火鍋', 石頭火鍋: '火鍋', 薑母鴨: '火鍋', 羊肉爐: '火鍋',
  海產: '海鮮', 熱炒: '海鮮', 魚: '海鮮', 蝦: '海鮮', 生魚片: '海鮮', 蚵仔: '海鮮', 虱目魚: '海鮮',
  鹹酥雞: '小吃', 滷味: '小吃', 肉圓: '小吃', 黑白切: '小吃', 米糕: '小吃', 肉粽: '小吃', 碗粿: '小吃', 蚵仔煎: '小吃', 小吃店: '小吃',
  漢堡: '速食', 披薩: '速食', pizza: '速食', 炸雞: '速食', 薯條: '速食', 麥當勞: '速食', 肯德基: '速食', 摩斯: '速食', 漢堡王: '速食', 速食店: '速食',
  飯盒: '便當', 便當店: '便當', 快餐: '自助餐', 自助: '自助餐',
  排餐: '牛排', 牛排館: '牛排',
  麵包: '', // 不是麵,只把字吃掉
};

const CUISINE_ALIAS: Record<string, string> = {
  日本: '日式', 日料: '日式', 日本料理: '日式', 和食: '日式', 日本菜: '日式',
  韓國: '韓式', 韓國菜: '韓式', 韓食: '韓式',
  泰國: '泰式', 泰國菜: '泰式', 泰菜: '泰式',
  香港: '港式', 港點: '港式', 茶餐廳: '港式',
  義大利: '義式', 意大利: '義式',
  美國: '美式',
  越南: '越式', 越南菜: '越式',
  印度菜: '印度',
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

/** 例句的正規化結果每次解析都一樣,載入時算一次就好 */
const NORMALIZED_EXAMPLES: { entry: (typeof CATALOGUE)[number]; texts: string[] }[] = CATALOGUE.map((e) => ({
  entry: e,
  texts: e.examples.map(normalizeText),
}));

const SIMILARITY_THRESHOLD = 0.5;
/** 第三層第一名要領先第二名這麼多才敢直接採用,否則反問(校準見 HANDOFF 問問看章節) */
export const SIMILARITY_MARGIN = 0.08;
const DEFAULT_CANDIDATE_IDS = ['any', 'cheap', 'walk'];

/** 每個意圖取「它所有例句中的最高分」,由高到低 */
export function scoreByIntent(text: string): { entry: CatalogueEntry; score: number }[] {
  return NORMALIZED_EXAMPLES.map(({ entry, texts }) => ({ entry, score: Math.max(...texts.map((t) => similarity(text, t))) }))
    .sort((a, b) => b.score - a.score);
}

function toCandidate(e: CatalogueEntry): IntentCandidate {
  return { id: e.id, question: e.question, label: e.label, reply: e.reply, actions: e.actions };
}

export function rankCandidates(text: string, limit = 3): IntentCandidate[] {
  const meaningful = scoreByIntent(text).filter((x) => x.score >= 0.2).slice(0, limit);
  const picked = meaningful.length ? meaningful.map((x) => x.entry) : DEFAULT_CANDIDATE_IDS.map((id) => CATALOGUE.find((e) => e.id === id)!);
  return picked.map(toCandidate);
}

/**
 * 把一句話切成子句:先在標點與轉折詞處切,再在每個「不要/不想…」前切開,
 * 這樣「想吃麵或飯不要便當」會變成 ["想吃麵或飯", "不要便當"],各自判方向。
 */
function splitClauses(raw: string): string[] {
  let t = raw.toLowerCase().replace(/[\s'"「」『』()（）:：]/g, '');
  t = t.replace(SEPARATORS, '|');
  for (const w of CONNECTIVES_BY_LEN) t = t.split(w).join('|');
  for (const w of NEGATE_PREFIX_BY_LEN) t = t.split(w).join('|' + w);
  return t.split('|').map((c) => c.trim()).filter(Boolean);
}

/**
 * 從一個子句裡找類別/菜系:詞彙本身與別名一起依長度排序,長的先比、比到就從文字裡「吃掉」,
 * 這樣「鍋貼」不會再讓「鍋」對到火鍋、「麵包」不會對到麵。別名對到空字串代表只吃掉、不算類別。
 */
function findTerms(text: string, vocab: string[], alias: Record<string, string>, rawHits?: string[]): string[] {
  const terms: [string, string][] = [...vocab.map((v): [string, string] => [v, v]), ...Object.entries(alias)];
  terms.sort((a, b) => b[0].length - a[0].length);
  const found = new Set<string>();
  let rest = text;
  for (const [term, target] of terms) {
    if (!term) continue;
    const t = term.toLowerCase();
    if (!rest.includes(t)) continue;
    rest = rest.split(t).join('\u0000');
    if (target && vocab.includes(target)) {
      found.add(target);
      rawHits?.push(term);
    }
  }
  return [...found];
}

/** 別名裡「類別的另一種說法」,不是一道具體的菜;其餘別名(牛肉麵、滷肉飯、小籠包…)都當菜名去比菜單 */
const GENERIC_ALIAS = new Set(['麵食', '麵條', '麵店', '鍋物', '鍋', '海產', '熱炒', '魚', '蝦', '自助', '快餐', '飯盒', '便當店', '速食店', '小吃店', '火鍋店', '牛排館', '排餐', '白飯']);

const CN_NUM: Record<string, number> = {
  五十: 50, 六十: 60, 七十: 70, 八十: 80, 九十: 90, 一百: 100, 一百二: 120, 一百五: 150, 兩百: 200, 二百: 200, 兩百五: 250, 三百: 300, 五百: 500,
};
const BUDGET_RE = new RegExp(`(?:預算)?(\\d{2,4}|${Object.keys(CN_NUM).sort((a, b) => b.length - a.length).join('|')})(?:元|塊錢|塊)?(?:以內|以下|之內|有找|內|左右)`);

/** 「100 元以內」「兩百塊有找」「預算 150 左右」→ 150;抓不到回 null */
export function parseBudget(text: string): number | null {
  const m = normalizeText(text).match(BUDGET_RE);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : CN_NUM[m[1]];
  return n >= 30 && n <= 3000 ? n : null;
}

/** 目錄條目在這句話裡有沒有命中:否定子句裡的關鍵字不算(「不要外帶」不是要外帶),除非關鍵字本身就帶否定(「不想開車」) */
function catalogueHit(clauses: { text: string; negated: boolean }[], keywords: string[]): number {
  let best = 0;
  for (const k of keywords) {
    const kw = k.toLowerCase();
    const selfNegated = hit(kw, NEGATE);
    for (const c of clauses) {
      if (c.text.includes(kw) && (!c.negated || selfNegated)) best = Math.max(best, kw.length);
    }
  }
  return best;
}

function unknown(text: string): Intent {
  return { kind: 'unknown', reply: UNKNOWN_REPLY, suggestions: EXAMPLE_QUESTIONS, candidates: rankCandidates(text) };
}

export function parseIntent(input: string, categories: string[], cuisines: string[] = []): Intent {
  const whole = normalizeText(input);
  if (!whole) return unknown(whole);

  // 1. 子句 → 想吃/不想吃 × 類別/菜系;同一項同時出現時「不吃」優先
  const wantCat = new Set<string>(), noCat = new Set<string>(), wantCui = new Set<string>(), noCui = new Set<string>();
  const clauses = splitClauses(input).map((text) => ({ text, negated: hit(text, NEGATE) }));
  const dishes = new Set<string>();
  for (const { text, negated } of clauses) {
    const raw: string[] = [];
    for (const c of findTerms(text, categories, CAT_ALIAS, raw)) (negated ? noCat : wantCat).add(c);
    if (!negated) for (const r of raw) if (CAT_ALIAS[r] && !GENERIC_ALIAS.has(r)) dishes.add(r);
    for (const c of findTerms(text, cuisines, CUISINE_ALIAS)) (negated ? noCui : wantCui).add(c);
  }
  for (const c of noCat) wantCat.delete(c);
  for (const c of noCui) wantCui.delete(c);
  // 菜名的類別被「不吃」掉了,菜名也不算
  for (const d of dishes) if (!wantCat.has(CAT_ALIAS[d])) dishes.delete(d);
  const budget = parseBudget(input);

  const actions: IntentActions = {};
  if (wantCat.size) actions.cat = [...wantCat];
  if (wantCui.size) actions.cuisine = [...wantCui];
  if (noCat.size) actions.excludeCat = [...noCat];
  if (noCui.size) actions.excludeCuisine = [...noCui];
  if (dishes.size) actions.dish = [...dishes];
  if (budget) actions.budget = budget;
  // 想吃/不吃的清單同時餵給標籤與回答句,只組一次;有講到菜名時用菜名取代它所屬的類別(「想吃牛肉麵」而不是「想吃麵」)
  const dishCats = new Set([...dishes].map((d) => CAT_ALIAS[d]));
  const want = [...wantCui, ...dishes, ...[...wantCat].filter((c) => !dishCats.has(c))];
  const avoid = [...noCui, ...noCat];
  const labels: string[] = [];
  if (want.length) labels.push(`想吃${want.join('、')}`);
  if (avoid.length) labels.push(`不吃${avoid.join('、')}`);
  if (budget) labels.push(`預算 ${budget} 內`);
  const slotParts = labels.length;

  // 2. 目錄關鍵字(可疊加)。同一個動作欄位(mode/service…)被多個條目命中時,關鍵字最長的那個贏:
  //    「不想開車」同時中 走路(不想開車) 與 開車(開車),走路的關鍵字較長所以是走路。
  const strength = new Map<string, number>();
  for (const e of CATALOGUE) {
    const n = catalogueHit(clauses, e.keywords);
    if (n) strength.set(e.id, n);
  }
  const winners = new Set<string>();
  for (const e of CATALOGUE) {
    const n = strength.get(e.id);
    if (!n) continue;
    const beaten = CATALOGUE.some(
      (o) => o.id !== e.id && (strength.get(o.id) ?? 0) > n && Object.keys(o.actions).some((k) => k in e.actions),
    );
    if (!beaten) winners.add(e.id);
  }
  const condLabels: string[] = [];
  let lastReply: string | null = null;
  for (const e of CATALOGUE) {
    if (winners.has(e.id)) {
      Object.assign(actions, e.actions);
      labels.push(e.label);
      condLabels.push(e.label);
      lastReply = e.reply;
    }
  }

  // 3. 都沒中才用相似度兜底:第一名要過門檻,而且要明顯領先第二名;兩個一樣像就是在猜,改反問
  if (!labels.length) {
    const ranked = scoreByIntent(whole);
    const [first, second] = ranked;
    if (!first || first.score < SIMILARITY_THRESHOLD) return unknown(whole);
    if (second && first.score - second.score < SIMILARITY_MARGIN) {
      return { kind: 'ambiguous', reply: AMBIGUOUS_REPLY, suggestions: EXAMPLE_QUESTIONS, candidates: ranked.slice(0, 3).map((r) => toCandidate(r.entry)) };
    }
    Object.assign(actions, first.entry.actions);
    labels.push(first.entry.label);
    lastReply = first.entry.reply;
  }

  // 4. 回答句:有槽位就組句,否則用目錄那句
  let reply: string;
  if (slotParts) {
    const bits = [want.length ? `想吃${want.join('、')}` : '', avoid.length ? `避開${avoid.join('、')}` : '', budget ? `${budget} 元以內` : '']
      .filter(Boolean)
      .join(',');
    const cond = condLabels.length ? `,${condLabels.join('、')}` : '';
    reply = `好,${bits}${cond} —— 這家如何:{shop}?`;
  } else {
    reply = lastReply ?? '那就交給運氣:{shop}!';
  }
  return { kind: 'matched', label: labels.join(' · '), reply, actions };
}
