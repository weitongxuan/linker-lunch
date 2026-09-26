/** 菜單文字格式:一行一項「品名 價格」,`【分類】` 開頭的行是標題,`(`/`（`/`※` 開頭的行是附註 */
export interface MenuSection {
  title: string | null;
  items: string[];
  notes: string[];
}

const isNote = (line: string) => /^[(（※]/.test(line);

export function parseMenu(text: string): MenuSection[] {
  const sections: MenuSection[] = [];
  let cur: MenuSection | null = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('【')) {
      cur = { title: line, items: [], notes: [] };
      sections.push(cur);
      continue;
    }
    if (!cur) {
      cur = { title: null, items: [], notes: [] };
      sections.push(cur);
    }
    (isNote(line) ? cur.notes : cur.items).push(line);
  }
  return sections;
}

export function countMenuItems(text: string): number {
  return parseMenu(text).reduce((n, s) => n + s.items.length, 0);
}

/** 把一行品項拆成品名與價格:價格是行尾的數字(可含 / 與 +)、「時價」,後面可再接一段括號附註 */
const PRICE_TAIL = /^(.*?)\s+((?:[+＋]?\d[\d/]*|時價)(?:\s*[(（][^)）]*[)）])?)$/;

export function splitMenuItem(line: string): { name: string; price: string | null } {
  const m = line.match(PRICE_TAIL);
  return m ? { name: m[1], price: m[2] } : { name: line, price: null };
}

const norm = (s: string) => s.toLowerCase().replace(/[\s()（）]/g, '');

/** 菜單裡品名含有 term 的品項行(最多 limit 行);比對忽略空白與括號 */
export function findMenuItems(text: string, term: string, limit = 3): string[] {
  const t = norm(term);
  if (!t) return [];
  const hits: string[] = [];
  for (const s of parseMenu(text)) {
    for (const it of s.items) {
      if (norm(splitMenuItem(it).name).includes(t)) {
        hits.push(it);
        if (hits.length >= limit) return hits;
      }
    }
  }
  return hits;
}

/** 品項的最低價(大小份取小份);加購(+10)不算一道菜,回 null */
export function itemMinPrice(line: string): number | null {
  const { price } = splitMenuItem(line);
  if (!price || /^[+＋]/.test(price)) return null;
  const nums = (price.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0);
  return nums.length ? Math.min(...nums) : null;
}

/** 品名去掉括號附註、份量字,剩下「這道菜叫什麼」:「紅燒牛肉麵(招牌)」→「紅燒牛肉麵」 */
export function dishName(line: string): string {
  return splitMenuItem(line)
    .name.replace(/[(（][^)）]*[)）]/g, '')
    .replace(/[\s·・/]+$/g, '')
    .trim();
}

/**
 * 從所有菜單長出「認得的菜名」清單,給問問看比對用。
 * 只收 2–8 個字、至少兩個中日文字的品名;stop 裡的字(類別名、問問看關鍵字)不收,免得一般問句被當成菜名。
 */
export function menuDishVocab(texts: string[], stop: Iterable<string> = []): string[] {
  const stopSet = new Set(stop);
  const seen = new Set<string>();
  for (const text of texts) {
    for (const s of parseMenu(text)) {
      for (const it of s.items) {
        const n = dishName(it);
        if (n.length < 2 || n.length > 8 || stopSet.has(n)) continue;
        if ((n.match(/[㐀-鿿぀-ヿ]/g) ?? []).length < 2) continue;
        seen.add(n);
      }
    }
  }
  return [...seen].sort((a, b) => b.length - a.length);
}

/** 預算內至少要有幾道菜,才算「這家吃得到」—— 只有一顆 15 元滷蛋在預算內不算 */
export const BUDGET_MIN_CHOICES = 3;

/** 菜單有價格時,預算內的品項夠不夠多;菜單沒價格就回 null(不知道,不要排除) */
export function fitsBudget(text: string, budget: number): boolean | null {
  const prices = parseMenu(text).flatMap((s) => s.items.map(itemMinPrice)).filter((p): p is number => p != null);
  if (prices.length < BUDGET_MIN_CHOICES) return null;
  return prices.filter((p) => p <= budget).length >= BUDGET_MIN_CHOICES;
}
