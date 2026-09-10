import { useMemo, useReducer, type ReactNode } from 'react';
import { FiltersContext, initialState, reducer } from './filtersStore.js';

// 型別從 store 轉出,舊的 import 路徑仍可用;值(useFilters)請改從 './filtersStore.js' 匯入
export type { UiState, ListTab, TravelMode, ViewMode, SortKey, PickWeight } from './filtersStore.js';

/** 只匯出這一個元件,讓 Vite 能 Fast Refresh */
export function FiltersProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}
