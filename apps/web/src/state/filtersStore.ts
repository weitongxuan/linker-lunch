/**
 * 篩選/UI 狀態的 context、reducer 與 useFilters hook。
 * 刻意與 FiltersProvider 元件分檔:Vite Fast Refresh 只能處理「只匯出元件」的模組,
 * 混在一起時每次改動都會讓執行中的頁面丟 useFilters 錯誤直到 reload。
 */
import { createContext, useContext } from 'react';
import { DEFAULT_FILTERS, TABS, todayKey } from '@lunch-map/shared';
import type { DayKey, FilterState, IntentActions, Mood, SortKey } from '@lunch-map/shared';
import { getDismissed, persistDismissed } from '../lib/dismissed.js';

export type { SortKey };
export type ViewMode = 'both' | 'list' | 'map';
/** 清單要看餐廳還是飲料,預設餐廳 */
export type ListTab = 'shops' | 'drinks' | 'desserts';
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
  /** 甜點分頁平常隱藏,使用者叫出來才顯示;偏好記在 localStorage */
  showDesserts: boolean;
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
  dismissed: Set<string>;
  secOpen: { drinks: boolean };
  filterDrawerOpen: boolean;
  keyword: string;
  /** 套用意圖後先立旗,等 rows 依新篩選重算完才抽,不然抽到舊清單 */
  pendingPick: boolean;
  /** 「我理解為:…」短標籤 */
  intentNote: string | null;
  /** 像在回話的回答句,{shop} 由推薦卡填入 */
  intentReply: string | null;
}

const SHOW_DESSERTS_KEY = 'lunchmap.showDesserts';
function readShowDesserts(): boolean {
  try {
    return localStorage.getItem(SHOW_DESSERTS_KEY) === '1';
  } catch {
    return false;
  }
}
function writeShowDesserts(v: boolean) {
  try {
    localStorage.setItem(SHOW_DESSERTS_KEY, v ? '1' : '0');
  } catch {
    // 無 localStorage 時偏好只活在這次 session
  }
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
    showDesserts: readShowDesserts(),
    sort: 'travel',
    filters: { ...DEFAULT_FILTERS, tier: new Set(), cat: new Set(), excludeCat: new Set(), price: new Set(), service: new Set() },
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
    dismissed: getDismissed(),
    secOpen: { drinks: true },
    filterDrawerOpen: false,
    keyword: '',
    pendingPick: false,
    intentNote: null,
    intentReply: null,
  };
}

export type Action =
  | { type: 'SET_DAY'; day: DayKey }
  | { type: 'SET_MODE'; mode: TravelMode }
  | { type: 'SET_VIEW'; view: ViewMode }
  | { type: 'SET_LIST_TAB'; tab: ListTab }
  | { type: 'TOGGLE_DESSERTS' }
  | { type: 'SET_SORT'; sort: SortKey }
  | { type: 'TOGGLE_SET_FILTER'; key: 'tier' | 'cat' | 'excludeCat' | 'price' | 'service'; value: string }
  | { type: 'SET_SET_FILTER'; key: 'cat' | 'excludeCat'; values: string[] }
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
  | { type: 'DISMISS_BANNER'; id: string }
  | { type: 'TOGGLE_SEC_OPEN'; key: 'drinks' }
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

export function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'SET_DAY':
      return { ...state, day: action.day, pickShopId: null, pickWeights: null };
    case 'SET_MODE':
      return { ...state, mode: action.mode, pickShopId: null, pickWeights: null };
    case 'SET_VIEW':
      return { ...state, view: action.view };
    case 'SET_LIST_TAB':
      return { ...state, listTab: action.tab };
    case 'TOGGLE_DESSERTS': {
      const show = !state.showDesserts;
      writeShowDesserts(show);
      return { ...state, showDesserts: show, listTab: !show && state.listTab === 'desserts' ? 'shops' : state.listTab };
    }
    case 'SET_SORT':
      return { ...state, sort: action.sort };
    case 'TOGGLE_SET_FILTER': {
      const current = state.filters[action.key] as Set<string>;
      const nextFilters: FilterState = { ...state.filters, [action.key]: toggleInSet(current, action.value) };
      return { ...state, filters: nextFilters, pickShopId: null, pickWeights: null };
    }
    case 'SET_SET_FILTER': {
      const nextFilters: FilterState = { ...state.filters, [action.key]: new Set(action.values) };
      return { ...state, filters: nextFilters, pickShopId: null, pickWeights: null };
    }
    case 'SET_BOOL_FILTER':
      return { ...state, filters: { ...state.filters, [action.key]: action.value } };
    case 'SET_MIN_SCORE':
      return { ...state, filters: { ...state.filters, minScore: action.value } };
    case 'SET_MIN_GOOGLE':
      return { ...state, filters: { ...state.filters, minGoogle: action.value } };
    case 'SET_MOOD':
      return { ...state, mood: action.mood, pickShopId: null, pickWeights: null };
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
    case 'DISMISS_BANNER': {
      const dismissed = new Set(state.dismissed).add(action.id);
      persistDismissed(dismissed);
      return { ...state, dismissed };
    }
    case 'TOGGLE_SEC_OPEN':
      return { ...state, secOpen: { ...state.secOpen, [action.key]: !state.secOpen[action.key] } };
    case 'TOGGLE_FILTER_DRAWER':
      return { ...state, filterDrawerOpen: !state.filterDrawerOpen };
    case 'SET_KEYWORD':
      return { ...state, keyword: action.keyword };
    case 'APPLY_INTENT': {
      const a = action.actions;
      const filters: FilterState = {
        ...state.filters,
        excludeCat: a.excludeCat ? new Set(a.excludeCat) : state.filters.excludeCat,
        cat: a.cat ? new Set(a.cat) : state.filters.cat,
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
