import type { DayKey, HourRange, WeeklyHours } from './types.js';

const DAY_CYCLE: DayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

/** OSM 兩字母代碼 -> 這個 app 用的 day key */
export const OSM_D: Record<string, DayKey> = {
  Mo: 'mon', Tu: 'tue', We: 'wed', Th: 'thu', Fr: 'fri', Sa: 'sat', Su: 'sun',
};

const DAY_CODE = '(?:Mo|Tu|We|Th|Fr|Sa|Su)';
const DAY_CODE_RE = new RegExp(`^${DAY_CODE}$`);
const DAY_RANGE_RE = new RegExp(`^(${DAY_CODE})-(${DAY_CODE})$`);
const TIME_RE = /^([0-2]\d:[0-5]\d)-([0-2]\d:[0-5]\d)$/;

/**
 * 展開像 "Mo-Fr" / "Mo,We,Fr" / "Mo-We,Fr" 這樣的 OSM 星期範圍寫法。
 * 遇到不認得的片段(例如 "PH" 國定假日)一律回傳 null —— 寧可讓人工確認,不猜。
 */
export function expandDays(spec: string): DayKey[] | null {
  const days = new Set<DayKey>();
  for (const raw of spec.split(',')) {
    const t = raw.trim();
    const range = t.match(DAY_RANGE_RE);
    if (range) {
      const startIdx = DAY_CYCLE.indexOf(OSM_D[range[1]]);
      const endIdx = DAY_CYCLE.indexOf(OSM_D[range[2]]);
      let i = startIdx;
      for (;;) {
        days.add(DAY_CYCLE[i]);
        if (i === endIdx) break;
        i = (i + 1) % 7;
      }
      continue;
    }
    if (DAY_CODE_RE.test(t)) {
      days.add(OSM_D[t]);
      continue;
    }
    return null;
  }
  return [...days];
}

function parseTimeSpans(spec: string): HourRange[] | null {
  const spans: HourRange[] = [];
  for (const raw of spec.split(',')) {
    const m = raw.trim().match(TIME_RE);
    if (!m) return null;
    spans.push([m[1], m[2]]);
  }
  return spans;
}

function emptyWeek(): WeeklyHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

/**
 * 把 OSM `opening_hours` 字串解析成這個 app 的每週時段結構。
 * 支援:24/7、分號分隔多條規則、逗號分隔的星期範圍、"off"、逗號分隔的多時段。
 * 任何一段解析不出來就整段回傳 null —— hoursRaw 保留原文,交給人工確認,不用猜的資料去判斷「吃得到」。
 */
export function parseOsmHours(str: string | undefined | null): WeeklyHours | null {
  const s = (str || '').trim();
  if (!s) return null;
  if (s === '24/7') {
    const week = emptyWeek();
    for (const d of DAY_CYCLE) week[d] = [['00:00', '24:00']];
    return week;
  }

  const result = emptyWeek();
  const rules = s.split(';').map((r) => r.trim()).filter(Boolean);
  if (!rules.length) return null;

  const ruleRe =
    /^([A-Za-z,-]+)\s+(off|(?:[0-2]\d:[0-5]\d-[0-2]\d:[0-5]\d)(?:,\s*[0-2]\d:[0-5]\d-[0-2]\d:[0-5]\d)*)$/;

  for (const rule of rules) {
    const m = rule.match(ruleRe);
    if (!m) return null;
    const days = expandDays(m[1]);
    if (!days) return null;
    if (m[2] === 'off') {
      for (const d of days) result[d] = [];
      continue;
    }
    const spans = parseTimeSpans(m[2]);
    if (!spans) return null;
    for (const d of days) result[d] = result[d].concat(spans);
  }
  return result;
}

const OSM_CAT: [RegExp, string][] = [
  [/noodle|ramen|拉麵|麵/i, '麵'],
  [/bento|便當/i, '便當'],
  [/buffet|自助/i, '自助餐'],
  [/vegetarian|vegan|素食/i, '素食'],
  [/breakfast|早午餐|早餐/i, '早餐'],
  [/rice|飯/i, '飯'],
];

/** 用店名+cuisine tag 猜分類(可能猜中不只一種),猜不到就丟「其他」,交給人工確認 */
export function guessCategory(name: string, cuisine?: string): string[] {
  const haystack = `${name} ${cuisine || ''}`;
  const hits = OSM_CAT.filter(([re]) => re.test(haystack)).map(([, label]) => label);
  return hits.length ? hits : ['其他'];
}

const PARKING_KIND: Record<string, string> = {
  multi_storey: '平面',
  underground: '地下',
  surface: '平面',
  street_side: '路邊',
  lane: '路邊',
};

export function guessParkingKind(osmParkingTag?: string): string {
  return (osmParkingTag && PARKING_KIND[osmParkingTag]) || '停車場';
}
