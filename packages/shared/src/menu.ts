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
