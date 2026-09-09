import { createContext, useContext, useMemo, useReducer, type ReactNode } from 'react';
import { DEFAULT_FILTERS, TABS, todayKey } from '@lunch-map/shared';
import type { DayKey, FilterState, Mood, Tier, Service } from '@lunch-map/shared';

export type SortKey = 'travel' | 'score' | 'usable' | 'votes';
export type TravelMode = 'auto' | 'walk' | 'drive';

export interface PickWeight {
  shopId: string;
  w: number;
}

export interface UiState {
  day: DayKey;
  mode: TravelMode;
  useNow: boolean;
  sort: SortKey;
  filters: FilterState;
  mood: Mood | 'auto';
  voteMode: boolean;
  pickShopId: string | null;
  pickEmpty: boolean;
  pickWeights: PickWeight[] | null;
  pickTotal: number;
  openDetail: Set<string>;
  dismissed: Set<string>;
  secOpen: { desserts: boolean; drinks: boolean };
  filterDrawerOpen: boolean;
}

function initialDay(): DayKey {
  const t = todayKey();
  return (TABS as string[]).includes(t) ? t : 'mon';
}

function initialState(): UiState {
  return {
    day: initialDay(),
    mode: 'auto',
    useNow: false,
    sort: 'travel',
    filters: { ...DEFAULT_FILTERS, tier: new Set(), cat: new Set(), price: new Set(), service: new Set() },
    mood: 'auto',
    voteMode: false,
    pickShopId: null,
    pickEmpty: false,
    pickWeights: null,
    pickTotal: 0,
    openDetail: new Set(),
    dismissed: new Set(),
    secOpen: { desserts: true, drinks: true },
    filterDrawerOpen: false,
  };
}

type Action =
  | { type: 'SET_DAY'; day: DayKey }
  | { type: 'SET_MODE'; mode: TravelMode }
  | { type: 'SET_USE_NOW'; value: boolean }
  | { type: 'SET_SORT'; sort: SortKey }
  | { type: 'TOGGLE_SET_FILTER'; key: 'tier' | 'cat' | 'price' | 'service'; value: string }
  | { type: 'SET_BOOL_FILTER'; key: 'onlyOpen' | 'showUnknown' | 'hideBad' | 'hideUnrated'; value: boolean }
  | { type: 'SET_MIN_SCORE'; value: number }
  | { type: 'SET_MIN_GOOGLE'; value: number }
  | { type: 'SET_MOOD'; mood: Mood | 'auto' }
  | { type: 'TOGGLE_VOTE_MODE' }
  | { type: 'SET_PICK'; shopId: string | null; weights: PickWeight[]; total: number }
  | { type: 'SET_PICK_EMPTY' }
  | { type: 'CLEAR_PICK' }
  | { type: 'TOGGLE_DETAIL'; id: string }
  | { type: 'DISMISS_BANNER'; id: string }
  | { type: 'TOGGLE_SEC_OPEN'; key: 'desserts' | 'drinks' }
  | { type: 'TOGGLE_FILTER_DRAWER' };

function toggleInSet<T>(set: Set<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

function reducer(state: UiState, action: Action): UiState {
  switch (action.type) {
    case 'SET_DAY':
      return { ...state, day: action.day, pickShopId: null, pickWeights: null };
    case 'SET_MODE':
      return { ...state, mode: action.mode, pickShopId: null, pickWeights: null };
    case 'SET_USE_NOW':
      return { ...state, useNow: action.value, pickShopId: null, pickWeights: null };
    case 'SET_SORT':
      return { ...state, sort: action.sort };
    case 'TOGGLE_SET_FILTER': {
      const current = state.filters[action.key] as Set<string>;
      const nextFilters: FilterState = { ...state.filters, [action.key]: toggleInSet(current, action.value) };
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
      return { ...state, pickShopId: null, pickWeights: null, pickEmpty: false };
    case 'TOGGLE_DETAIL':
      return { ...state, openDetail: toggleInSet(state.openDetail, action.id) };
    case 'DISMISS_BANNER':
      return { ...state, dismissed: new Set(state.dismissed).add(action.id) };
    case 'TOGGLE_SEC_OPEN':
      return { ...state, secOpen: { ...state.secOpen, [action.key]: !state.secOpen[action.key] } };
    case 'TOGGLE_FILTER_DRAWER':
      return { ...state, filterDrawerOpen: !state.filterDrawerOpen };
    default:
      return state;
  }
}

interface FiltersContextValue {
  state: UiState;
  dispatch: React.Dispatch<Action>;
}

const FiltersContext = createContext<FiltersContextValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersContextValue {
  const ctx = useContext(FiltersContext);
  if (!ctx) throw new Error('useFilters must be used within FiltersProvider');
  return ctx;
}
