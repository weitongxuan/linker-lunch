import { useEffect, useState } from 'react';
import { currentMood, MOOD_TABLE } from '@lunch-map/shared';
import type { Market } from '@lunch-map/shared';
import { useFilters, type TravelMode } from '../state/FiltersContext.js';
import type { LocationStatus } from '../hooks/useMyLocation.js';

interface Props {
  market: Market | null;
  onRandomPick: () => void;
  onOpenAddShop: () => void;
  myLocation: {
    coords: { lat: number; lng: number } | null;
    status: LocationStatus;
    request: () => void;
    clear: () => void;
  };
}

const LOCATION_LABEL: Record<LocationStatus, string> = {
  idle: '📍 用我的位置',
  locating: '📍 定位中…',
  ready: '📍 我的位置',
  denied: '📍 定位被拒絕',
  unavailable: '📍 無法定位',
};

const SEARCH_DEBOUNCE_MS = 500;

export function Toolbar({ market, onRandomPick, onOpenAddShop, myLocation }: Props) {
  const { state, dispatch } = useFilters();
  const f = state.filters;

  const [keywordInput, setKeywordInput] = useState(state.keyword);

  useEffect(() => {
    const id = setTimeout(() => dispatch({ type: 'SET_KEYWORD', keyword: keywordInput }), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only debounce on local input changes, not on external keyword resets
  }, [keywordInput]);

  const activeFilterCount =
    f.tier.size +
    f.cat.size +
    f.excludeCat.size +
    f.price.size +
    f.service.size +
    (f.minScore ? 1 : 0) +
    (f.hideUnrated ? 1 : 0) +
    (f.onlyOpen ? 0 : 1) +
    (f.hideBad ? 0 : 1) +
    (f.showUnknown ? 0 : 1) +
    (f.minGoogle ? 1 : 0);

  const mood = currentMood(state.mood, market);
  const mktClass = !market ? 'off' : mood === 'up' ? 'up' : mood === 'down' ? 'down' : 'flat';
  const mktLabel = market
    ? `${market.index} ${market.pct >= 0 ? '+' : ''}${market.pct.toFixed(2)}% · ${mood ? MOOD_TABLE[mood].label : ''}`
    : '沒有行情資料';

  return (
    <div className="bar1">
      <span className="seg">
        {(['walk', 'drive'] as TravelMode[]).map((m) => (
          <button
            key={m}
            className={state.mode === m ? 'on' : ''}
            onClick={() => dispatch({ type: 'SET_MODE', mode: m })}
          >
            {m === 'walk' ? '走路' : '開車'}
          </button>
        ))}
      </span>
      <span className="spacer" />
      <input
        className="searchInput"
        type="text"
        value={keywordInput}
        placeholder="🔍 搜尋店家"
        onChange={(e) => setKeywordInput(e.target.value)}
      />
      <button
        className={`btn${myLocation.status === 'ready' ? ' pri' : ''}`}
        disabled={myLocation.status === 'locating'}
        title={myLocation.status === 'ready' ? '目前用你的位置算距離,點一下改回辦公室' : '用瀏覽器定位當作距離的起點'}
        onClick={() => (myLocation.status === 'ready' ? myLocation.clear() : myLocation.request())}
      >
        {LOCATION_LABEL[myLocation.status]}
      </button>
      <button className="btn" onClick={onOpenAddShop}>
        ➕ 新增店家
      </button>
      <button className="btn pri" onClick={onRandomPick}>
        🎲 隨機推薦
      </button>
      <span className={`mkt ${mktClass}`} title="看行情決定吃什麼">
        {mktLabel}
      </span>
      <button
        className={`btn${state.filterDrawerOpen ? ' pri' : ''}`}
        onClick={() => dispatch({ type: 'TOGGLE_FILTER_DRAWER' })}
      >
        篩選<b>{activeFilterCount > 0 ? activeFilterCount : ''}</b>
      </button>
      <span className="seg viewSeg">
        {(['both', 'list', 'map'] as const).map((v) => (
          <button key={v} className={state.view === v ? 'on' : ''} onClick={() => dispatch({ type: 'SET_VIEW', view: v })}>
            {v === 'both' ? '雙檢視' : v === 'list' ? '清單' : '地圖'}
          </button>
        ))}
      </span>
    </div>
  );
}
