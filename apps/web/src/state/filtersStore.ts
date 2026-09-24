/**
 * 篩選/UI 狀態的 context、reducer 與 useFilters hook。
 * 刻意與 FiltersProvider 元件分檔:Vite Fast Refresh 只能處理「只匯出元件」的模組,
 * 混在一起時每次改動都會讓執行中的頁面丟 useFilters 錯誤直到 reload。
 */
import { createContext, useContext } from 'react';
import { DEFAULT_FILTERS, TABS, todayKey } from '@lunch-map/shared';
import type { DayKey, FilterState, IntentActions, Mood, SortKey } from '@lunch-map/shared';

export type { SortKey };
export type ViewMode = 'both' | 'list' | 'map';
/** 清單要看餐廳還是飲料,預設餐廳 */
export type ListTab = 'shops' | 'drinks';
/** 只給使用者走路/開車兩個選項:開車 15 分的範圍涵蓋所有店家,再加一個「全部」跟開車完全重複 */
export type TravelMode = 'walk' | 'drive';

export interface PickWeight {
  shopId: string;
  w: number;
}

export interface UiState {
  day: DayKey;
  mode: TravelMode;
  view: ViewMode;
  listTab: ListTab;
  sort: SortKey;
  filters: FilterState;
  mood: Mood | 'auto';
  voteMode: boolean;
  pickShopId: string | null;
  pickEmpty: boolean;
  pickWeights: PickWeight[] | null;
  pickTotal: number;
  sel: string | null;
  editShopId: string | null;
  editDrinkId: string | null;
  openDetail: Set<string>;
  /** 飲料區是否展開 */
  drinksOpen: boolean;
  filterDrawerOpen: boolean;
  keyword: string;
  /** 套用意圖後先立旗,等 rows 依新篩選重算完才抽,不然抽到舊清單 */
  pendingPick: boolean;
  /** 「我理解為:…」短標籤 */
  intentNote: string | null;
  /** 像在回話的回答句,{shop} 由推薦卡填入 */
  intentReply: string | null;
}

function initialDay(): DayKey {
  const t = todayKey();
  return (TABS as string[]).includes(t) ? t : 'mon';
}

export function initialState(): UiState {
  return {
    day: initialDay(),
    mode: 'drive',
    view: 'both',
    listTab: 'shops',
    sort: 'travel',
    // Set 要各自複製一份,不然多個 store 實例會共用同一個 Set;price 沿用預設的 $$$ 以下
    filters: { ...DEFAULT_FILTERS, tier: new Set(), cat: new Set(), excludeCat: new Set(), cuisine: new Set(), excludeCuisine: new Set(), price: new Set(DEFAULT_FILTERS.price), service: new Set() },
    mood: 'auto',
    voteMode: false,
    pickShopId: null,
    pickEmpty: false,
    pickWeights: null,
    pickTotal: 0,
    sel: null,
    editShopId: null,
    editDrinkId: null,
    openDetail: new Set(),
    drinksOpen: true,
    filterDrawerOpen: false,
    keyword: '',
    pendingPick: false,
    intentNote: null,
    intentReply: null,
  };
}

/** filters 裡值為 Set 的欄位,加/減一項與整組覆寫共用 */
export type SetFilterKey = 'tier' | 'cat' | 'excludeCat' | 'cuisine' | 'excludeCuisine' | 'price' | 'service';

export type Action =
  | { type: 'SET_DAY'; day: DayKey }
  | { type: 'SET_MODE'; mode: TravelMode }
  | { type: 'SET_VIEW'; view: ViewMode }
  | { type: 'SET_LIST_TAB'; tab: ListTab }
  | { type: 'SET_SORT'; sort: SortKey }
  | { type: 'TOGGLE_SET_FILTER'; key: SetFilterKey; value: string }
  | { type: 'SET_SET_FILTER'; key: SetFilterKey; values: string[] }
  | { type: 'SET_BOOL_FILTER'; key: 'onlyOpen' | 'showUnknown' | 'hideBad' | 'hideUnrated'; value: boolean }
  | { type: 'SET_MIN_SCORE'; value: number }
  | { type: 'SET_MIN_GOOGLE'; value: number }
  | { type: 'SET_MOOD'; mood: Mood | 'auto' }
  | { type: 'TOGGLE_VOTE_MODE' }
  | { type: 'SET_PICK'; shopId: string | null; weights: PickWeight[]; total: number }
  | { type: 'SET_PICK_EMPTY' }
  | { type: 'CLEAR_PICK' }
  | { type: 'SET_SEL'; id: string | null }
  | { type: 'SET_EDIT_SHOP'; id: string | null }
  | { type: 'SET_EDIT_DRINK'; id: string | null }
  | { type: 'TOGGLE_DETAIL'; id: string }
  | { type: 'TOGGLE_DRINKS_OPEN' }
  | { type: 'TOGGLE_FILTER_DRAWER' }
  | { type: 'SET_KEYWORD'; keyword: string }
  | { type: 'APPLY_INTENT'; actions: IntentActions; label: string; reply: string }
  | { type: 'CLEAR_PENDING_PICK' };

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

/** 使用者自己動了條件,問問看那句「我理解為…」就不再成立,一起清掉 */
const NO_INTENT = { intentNote: null, intentReply: null } as const;

export function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'SET_DAY':
      return { ...state, ...NO_INTENT, day: action.day, pickShopId: null, pickWeights: null };
    case 'SET_MODE':
      return { ...state, mode: action.mode, pickShopId: null, pickWeights: null };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_LIST_TAB':
      return { ...state, listTab: action.tab };
    case 'SET_SORT':
      return { ...state, sort: action.sort };
    case 'TOGGLE_SET_FILTER': {
      const current = state.filters[action.key] as Set<string>;
      const nextFilters: FilterState = { ...state.filters, [action.key]: toggleInSet(current, action.value) };
      return { ...state, ...NO_INTENT, filters: nextFilters, pickShopId: null, pickWeights: null };
    }
    case 'SET_SET_FILTER': {
      const nextFilters: FilterState = { ...state.filters, [action.key]: new Set(action.values) };
      return { ...state, ...NO_INTENT, filters: nextFilters, pickShopId: null, pickWeights: null };
    }
    case 'SET_BOOL_FILTER':
      return { ...state, ...NO_INTENT, filters: { ...state.filters, [action.key]: action.value } };
    case 'SET_MIN_SCORE':
      return { ...state, ...NO_INTENT, filters: { ...state.filters, minScore: action.value } };
    case 'SET_MIN_GOOGLE':
      return { ...state, ...NO_INTENT, filters: { ...state.filters, minGoogle: action.value } };
    case 'SET_MOOD':
      return { ...state, ...NO_INTENT, mood: action.mood, pickShopId: null, pickWeights: null };
    case 'TOGGLE_VOTE_MODE':
      return { ...state, voteMode: !state.voteMode, sort: !state.voteMode ? 'votes' : state.sort };
    case 'SET_PICK':
      return { ...state, pickShopId: action.shopId, pickWeights: action.weights, pickTotal: action.total, pickEmpty: false };
    case 'SET_PICK_EMPTY':
      return { ...state, pickShopId: null, pickWeights: null, pickEmpty: true };
    case 'CLEAR_PICK':
      return { ...state, pickShopId: null, pickWeights: null, pickEmpty: false, intentNote: null, intentReply: null };
    case 'SET_SEL':
      return { ...state, sel: action.id };
    case 'SET_EDIT_SHOP':
      return { ...state, editShopId: action.id };
    case 'SET_EDIT_DRINK':
      return { ...state, editDrinkId: action.id };
    case 'TOGGLE_DETAIL':
      return { ...state, openDetail: toggleInSet(state.openDetail, action.id) };
    case 'TOGGLE_DRINKS_OPEN':
      return { ...state, drinksOpen: !state.drinksOpen };
    case 'TOGGLE_FILTER_DRAWER':
      return { ...state, filterDrawerOpen: !state.filterDrawerOpen };
    case 'SET_KEYWORD':
      return { ...state, keyword: action.keyword };
    case 'APPLY_INTENT': {
      const a = action.actions;
      // 不同句之間的條件會累加(「不想吃便當」之後再說「不想吃麵」= 兩個都不吃);
      // 同一項新說想吃就從不吃裡拿掉,反之亦然。條件列有 × 可以逐一移除。
      const merge = (cur: Set<string>, add?: string[], drop?: string[]) => {
        const s = new Set(cur);
        (add ?? []).forEach((v) => s.add(v));
        (drop ?? []).forEach((v) => s.delete(v));
        return s;
      };
      const filters: FilterState = {
        ...state.filters,
        cat: merge(state.filters.cat, a.cat, a.excludeCat),
        excludeCat: merge(state.filters.excludeCat, a.excludeCat, a.cat),
        cuisine: merge(state.filters.cuisine, a.cuisine, a.excludeCuisine),
        excludeCuisine: merge(state.filters.excludeCuisine, a.excludeCuisine, a.cuisine),
        minGoogle: a.minGoogle ?? state.filters.minGoogle,
        service: a.service ? new Set(a.service) : state.filters.service,
      };
      return {
        ...state,
        filters,
        mood: a.mood ?? state.mood,
        mode: a.mode ?? state.mode,
        pendingPick: true,
        intentNote: action.label,
        intentReply: action.reply,
        pickShopId: null,
        pickWeights: null,
      };
    }
    case 'CLEAR_PENDING_PICK':
      return { ...state, pendingPick: false };
    default:
      return state;
  }
}

export interface FiltersContextValue {
  state: UiState;
  dispatch: React.Dispatch<Action>;
}

export const FiltersContext = createContext<FiltersContextValue | null>(null);

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
