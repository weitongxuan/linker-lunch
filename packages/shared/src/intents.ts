import type { Mood } from './types.js';

/**
 * 第一層「像 inline AI 的輸入框」:不呼叫模型,把一句話翻成既有的篩選開關。
 * 問題目錄(EXAMPLE_QUESTIONS)先列好大家可能會問的句子;輸入相似就套用對應動作,
 * 類別是可替換的槽位,從資料動態帶入,不寫死。
 */
export interface IntentActions {
  excludeCat?: string[];
  cat?: string[];
  mood?: Mood;
  mode?: 'walk' | 'drive';
  minGoogle?: number;
}

export type Intent =
  | { kind: 'matched'; label: string; actions: IntentActions }
  | { kind: 'unknown'; suggestions: string[] };

/** 給使用者點的例句,也是「聽不懂」時的提示 */
export const EXAMPLE_QUESTIONS = [
  '我今天不想吃便當',
  '想吃麵',
  '便宜一點的',
  '今天吃好一點',
  '走路就到的',
  '評價好的',
  '隨便推薦一家',
];

const NEGATE = ['不想吃', '不要吃', '不吃', '不要', '吃膩', '膩了', '別吃', '不想'];
const WANT = ['想吃', '要吃', '來點', '給我', '想要', '吃點'];
const CHEAP = ['便宜', '省錢', '省一點', '平價', '窮', '沒錢', '省'];
const FANCY = ['吃好一點', '吃好', '加菜', '慶祝', '貴一點', '大餐', '犒賞', '奢侈'];
const WALK = ['走路', '不開車', '不想開車', '附近', '走過去', '走去'];
const DRIVE = ['開車', '遠一點', '開過去'];
const GOOD = ['評價好', '高分', '好吃的', '熱門', '評價高', '推薦的', '有名'];
const ANY = ['隨便', '都可以', '幫我選', '靈感', '不知道吃什麼', '推薦一家', '隨機', '抽一家', '選一家'];

/** 類別別名:使用者的口語 → 資料裡的類別名 */
const CAT_ALIAS: Record<string, string> = {
  拉麵: '麵', 麵食: '麵', 麵條: '麵', 義大利麵: '麵', 乾麵: '麵',
  炒飯: '飯', 燴飯: '飯', 丼: '飯', 咖哩: '飯',
  餃子: '水餃', 湯包: '水餃',
  火鍋: '火鍋', 鍋物: '火鍋', 涮涮鍋: '火鍋',
  海產: '海鮮', 熱炒: '海鮮',
  漢堡: '速食', 披薩: '速食', pizza: '速食', 炸雞: '速食',
  飯盒: '便當', 自助餐: '自助餐', 快餐: '自助餐',
  咖啡: '甜點', 咖啡廳: '甜點', 甜食: '甜點', 下午茶: '甜點',
};

export function normalizeText(s: string): string {
  return s.toLowerCase().replace(/[\s，,。．.！!？?、;；:：~～'"「」『』()（）]/g, '');
}

function has(text: string, words: string[]): string | null {
  for (const w of words) if (text.includes(w.toLowerCase())) return w;
  return null;
}

/** 在句子裡找類別:先找資料裡的正式類別名(長的優先),再找別名 */
function findCategories(text: string, categories: string[]): string[] {
  const found = new Set<string>();
  const byLen = [...categories].sort((a, b) => b.length - a.length);
  for (const c of byLen) if (c && text.includes(c.toLowerCase())) found.add(c);
  for (const [alias, cat] of Object.entries(CAT_ALIAS)) {
    if (text.includes(alias.toLowerCase()) && categories.includes(cat)) found.add(cat);
  }
  return [...found];
}

export function parseIntent(input: string, categories: string[]): Intent {
  const text = normalizeText(input);
  if (!text) return { kind: 'unknown', suggestions: EXAMPLE_QUESTIONS };

  const actions: IntentActions = {};
  const parts: string[] = [];

  const cats = findCategories(text, categories);
  if (cats.length) {
    if (has(text, NEGATE)) {
      actions.excludeCat = cats;
      parts.push(`不吃${cats.join('、')}`);
    } else {
      actions.cat = cats;
      parts.push(`想吃${cats.join('、')}`);
    }
  } else if (has(text, WANT) || has(text, NEGATE)) {
    // 有動詞卻對不到任何類別:別亂猜,回例句
    return { kind: 'unknown', suggestions: EXAMPLE_QUESTIONS };
  }

  if (has(text, FANCY)) { actions.mood = 'up'; parts.push('吃好一點'); }
  else if (has(text, CHEAP)) { actions.mood = 'down'; parts.push('省一點'); }

  if (has(text, WALK)) { actions.mode = 'walk'; parts.push('走路'); }
  else if (has(text, DRIVE)) { actions.mode = 'drive'; parts.push('開車'); }

  if (has(text, GOOD)) { actions.minGoogle = 4.0; parts.push('Google 4.0 以上'); }

  const justPick = has(text, ANY);
  if (!parts.length && !justPick) return { kind: 'unknown', suggestions: EXAMPLE_QUESTIONS };

  return { kind: 'matched', label: parts.length ? parts.join(' · ') : '隨便推薦', actions };
}
