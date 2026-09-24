import type { Mood, Service } from './types.js';

/** 一句話能扳動的既有開關;沒有對應開關的屬性(清淡/有湯/排隊)不假裝會篩 */
export interface IntentActions {
  excludeCat?: string[];
  cat?: string[];
  cuisine?: string[];
  excludeCuisine?: string[];
  mood?: Mood;
  mode?: 'walk' | 'drive';
  minGoogle?: number;
  service?: Service[];
}

export interface CatalogueEntry {
  id: string;
  /** 大家可能會怎麼問;第一句當代表例句。也是相似度比對的樣本 */
  examples: string[];
  /** 任一命中即成立的關鍵字 */
  keywords: string[];
  actions: IntentActions;
  label: string;
  /** 像在回話的回答,{shop} 由推薦卡填入 */
  reply: string;
  /** 聽不懂時反問用的選項文字 */
  question: string;
}

/**
 * 問題目錄(不含類別槽位)。類別槽位「不想吃X / 想吃X」由 SLOT_TEMPLATES × 資料類別展開。
 * 先想好一百多種問法,偵測到差不多的就回答 —— 假 AI 的本體就是這張表。
 */
export const CATALOGUE: CatalogueEntry[] = [
  {
    id: 'cheap',
    examples: [
      '便宜一點的', '今天想省錢', '口袋沒什麼錢', '有沒有平價的', '月底了吃便宜點', '想吃銅板價',
      '一百塊以內的', '省一點', '不要太貴', '窮學生餐', '便宜又大碗', '有沒有划算的', 'CP值高的',
      '今天沒錢', '省錢餐', '便宜就好',
    ],
    keywords: ['便宜', '省錢', '省一點', '平價', '窮', '沒錢', '省', '划算', '銅板', 'cp值', '不要太貴', '一百塊', '大碗', '月底'],
    actions: { mood: 'down' },
    label: '省一點',
    reply: '省一點的話,這家不錯:{shop}',
    question: '想找便宜一點的?',
  },
  {
    id: 'fancy',
    examples: [
      '今天吃好一點', '想犒賞自己', '來個大餐', '發薪日吃好料', '今天想奢侈一下', '吃貴一點沒關係',
      '慶祝一下', '想吃高級的', '今天心情好吃好的', '有什麼好料', '加菜', '想吃有質感的',
    ],
    keywords: ['吃好一點', '吃好', '加菜', '慶祝', '貴一點', '大餐', '犒賞', '奢侈', '高級', '好料', '發薪', '質感', '吃好的'],
    actions: { mood: 'up' },
    label: '吃好一點',
    reply: '今天吃好一點,{shop} 如何?',
    question: '今天想吃好一點?',
  },
  {
    id: 'walk',
    examples: [
      '走路就到的', '有沒有走路能到的', '懶得開車', '附近就好', '不想開車', '走過去的',
      '近一點的', '離公司近的', '不想走太遠', '五分鐘內的', '樓下有什麼', '走得到的',
    ],
    keywords: ['走路', '不開車', '不想開車', '不要開車', '不用開車', '附近', '走過去', '走去', '懶得開', '走的到', '走得到', '近一點', '離公司近', '不想走太遠', '五分鐘', '樓下'],
    actions: { mode: 'walk' },
    label: '走路',
    reply: '走路就到,不用找車位:{shop}',
    question: '走路就到的?',
  },
  {
    id: 'drive',
    examples: [
      '開車去遠一點', '今天可以開車', '有人開車載', '遠一點也沒關係', '開車去吃', '想去遠一點的地方',
      '有車可以開', '不限距離',
    ],
    keywords: ['開車', '遠一點', '開過去', '可以開', '有車', '載', '不限距離', '遠一點也'],
    actions: { mode: 'drive' },
    label: '開車',
    reply: '那就開車,範圍放大一點:{shop}',
    question: '開車去遠一點的?',
  },
  {
    id: 'good',
    examples: [
      '評價好的', '有什麼好吃的', '推薦高分的', '不要踩雷', '評價高的', '有名的店', 'Google 評價好的',
      '網路評價好的', '推薦一家好吃的', '大家都說好吃的', '口碑好的', '四星以上的', '好評的',
    ],
    keywords: ['評價好', '高分', '好吃的', '熱門', '評價高', '推薦的', '有名', '好評', '不踩雷', '不要踩雷', '口碑', '四星', '大家都說', '評價'],
    actions: { minGoogle: 4.0 },
    label: 'Google 4.0 以上',
    reply: 'Google 4 分以上的:{shop}',
    question: '要評價好的?',
  },
  {
    id: 'takeout',
    examples: [
      '想外帶', '帶回公司吃', '外帶就好', '可以外帶的', '買回來吃', '不想在外面吃', '打包回來',
      '外帶回辦公室',
    ],
    keywords: ['外帶', '帶回', '買回來', '打包', '不想在外面吃', '帶走'],
    actions: { service: ['takeout'] },
    label: '外帶',
    reply: '可以外帶的:{shop}',
    question: '要外帶回來吃?',
  },
  {
    id: 'dinein',
    examples: [
      '想坐下來吃', '要有位子的', '想內用', '找有冷氣的', '想坐著慢慢吃', '有座位的店',
    ],
    keywords: ['坐下來', '內用', '有位子', '有座位', '冷氣', '坐著', '慢慢吃'],
    actions: { service: ['dine_in'] },
    label: '內用',
    reply: '可以坐下來吃的:{shop}',
    question: '想坐下來內用?',
  },
  {
    id: 'again',
    examples: [
      '換一家', '再抽一次', '這家不要', '有別的嗎', '不喜歡這家', '重抽', '再給我一個', '別的選擇',
    ],
    keywords: ['換一家', '再抽', '這家不要', '有別的', '不喜歡這家', '重抽', '再給我', '別的選擇', '換別家', '另一家'],
    actions: {},
    label: '換一家',
    reply: '好,換這家:{shop}',
    question: '換一家看看?',
  },
  {
    id: 'any',
    examples: [
      '隨便推薦一家', '不知道吃什麼', '幫我決定', '給我一點靈感', '中午吃什麼', '今天吃什麼好',
      '隨便', '都可以', '幫我選', '你決定', '抽一家', '沒想法', '推薦一下', '有什麼建議',
      '今天吃哪家', '午餐吃啥', '幫我想', '選擇障礙', '你說呢', '看你',
    ],
    keywords: ['隨便', '都可以', '幫我選', '靈感', '不知道吃什麼', '推薦一家', '隨機', '抽一家', '選一家', '幫我決定', '決定', '沒想法', '吃什麼', '推薦一下', '建議', '吃哪家', '吃啥', '幫我想', '選擇障礙', '你說呢', '看你', '你選'],
    actions: {},
    label: '隨便推薦',
    reply: '那就交給運氣:{shop}!',
    question: '直接幫你隨便推薦一家?',
  },
  {
    id: 'quick',
    examples: [
      '趕時間', '快一點的', '半小時要回來', '只有二十分鐘', '要快', '簡單吃', '快速解決', '時間不多',
    ],
    keywords: ['趕時間', '快一點', '半小時', '二十分鐘', '要快', '簡單吃', '快速', '時間不多', '快點'],
    actions: { mode: 'walk' },
    label: '趕時間(走路)',
    reply: '趕時間的話走路最快,這家:{shop}',
    question: '趕時間,要快的?',
  },
  {
    id: 'light',
    examples: [
      '想吃清淡的', '吃健康一點', '不要太油', '想吃蔬菜', '減脂餐', '清爽一點的', '不想吃太重口味',
      '想吃有湯的', '想喝湯', '暖暖的', '熱的東西',
    ],
    keywords: ['清淡', '健康', '不要太油', '蔬菜', '減脂', '清爽', '重口味', '有湯', '喝湯', '暖暖', '熱的'],
    actions: {},
    label: '清淡/口味(資料沒有這個欄位)',
    reply: '我還分不出清淡或有沒有湯,先隨機給你一家,你再看:{shop}',
    question: '想吃清淡一點的?',
  },
  {
    id: 'group',
    examples: [
      '很多人一起吃', '部門聚餐', '五個人以上', '要能坐一桌的', '大家一起去', '團體聚餐',
    ],
    keywords: ['很多人', '聚餐', '五個人', '一桌', '大家一起', '團體', '多人', '一群'],
    actions: { service: ['dine_in'] },
    label: '聚餐(內用)',
    reply: '人多要能坐,這家可以內用:{shop}',
    question: '很多人一起吃?',
  },
];

/** 類別槽位的問法模板;{cat} 會用資料裡每個類別展開 */
export const SLOT_TEMPLATES = {
  exclude: ['我今天不想吃{cat}', '不要{cat}', '{cat}吃膩了', '別再吃{cat}了', '{cat}以外的', '除了{cat}都可以', '不吃{cat}'],
  include: ['想吃{cat}', '來點{cat}', '今天吃{cat}', '有沒有{cat}', '給我{cat}', '{cat}有推薦的嗎'],
  excludeCuisine: ['不想吃{cuisine}', '不要{cuisine}', '{cuisine}以外的', '{cuisine}吃膩了'],
  includeCuisine: ['想吃{cuisine}', '來點{cuisine}', '今天吃{cuisine}', '有沒有{cuisine}'],
};

export const UNKNOWN_REPLY = '這句我還不太懂,可以像這樣問我:';
export const AMBIGUOUS_REPLY = '這句我不太確定,你是想…?';
