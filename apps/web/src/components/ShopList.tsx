import { useMemo, useState } from 'react';
import { findMenuItems, haversine, openNowState, walkMinFor } from '@lunch-map/shared';
import type { AfterPlace, Config, DayKey } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';
import { useFilters } from '../state/filtersStore.js';
import { ShopCard } from './ShopCard.js';

interface Props {
  visibleRows: Row[];
  config: Config;
  menus: Record<string, string>;
  drinks: AfterPlace[];
  day: DayKey;
  nowMinute: number;
  onSelectOnMap: (shopId: string) => void;
}

/** 一次只掛這麼多張卡片:幾百張一起掛上,每點一個篩選畫面就凍住好幾秒(開發模式尤其明顯) */
const PAGE = 60;

export function ShopList({ visibleRows, config, menus, drinks, day, nowMinute, onSelectOnMap }: Props) {
  const { state } = useFilters();
  const [limit, setLimit] = useState(PAGE);
  // 條件一變就回到第一頁;用 render 期間比對而不是 effect,才不會先畫一次全部再縮回來
  const [seenRows, setSeenRows] = useState(visibleRows);
  if (seenRows !== visibleRows) {
    setSeenRows(visibleRows);
    setLimit(PAGE);
  }

  const selectedRow = state.sel ? (visibleRows.find((r) => r.sh.id === state.sel) ?? null) : null;

  const orderedRows = selectedRow
    ? [selectedRow, ...visibleRows.filter((r) => r.sh.id !== selectedRow.sh.id)]
    : visibleRows;
  const shownRows = orderedRows.slice(0, limit);
  // 搜尋字或問問看的菜名在菜單裡命中的那幾行,卡片上直接顯示,不用點開詳情
  const terms = [state.keyword.trim(), ...state.filters.dish].filter(Boolean);
  const menuHitsFor = (text: string) => (terms.length ? [...new Set(terms.flatMap((t) => findMenuItems(text, t, 2)))].slice(0, 3) : []);
  const remaining = orderedRows.length - shownRows.length;

  const nearbyDrinks = useMemo(() => {
    if (!selectedRow) return [];
    return drinks
      .map((d) => ({ d, meters: haversine(selectedRow.sh, d), open: openNowState(d, day, nowMinute) }))
      .sort((a, b) => a.meters - b.meters);
  }, [drinks, selectedRow, day, nowMinute]);

  return (
    <>
      <div id="list">
        {visibleRows.length === 0 && <div className="hint">目前的篩選條件下沒有店家 —— 試試看放寬篩選。</div>}
        {shownRows.map((row) => (
          <ShopCard
            key={row.sh.id}
            row={row}
            config={config}
            menuText={menus[row.sh.id] ?? ''}
            menuHits={menuHitsFor(menus[row.sh.id] ?? '')}
            onSelectOnMap={onSelectOnMap}
            className={selectedRow && row.sh.id !== selectedRow.sh.id ? 'fadeout' : undefined}
          />
        ))}
        {remaining > 0 && (
          <button className="btn more" onClick={() => setLimit((n) => n + PAGE)}>
            再顯示 {Math.min(PAGE, remaining)} 家(還有 {remaining} 家)
          </button>
        )}
        {selectedRow && nearbyDrinks.length > 0 && (
          <>
            <div className="dhead sel-divider">
              <span className="dtitle">離「{selectedRow.sh.name}」最近的飲料店</span>
            </div>
            {nearbyDrinks.map(({ d, meters, open }) => (
              <div key={d.id} className={`drow${open.code === 'closed' ? ' dim' : ''}`}>
                <span className="dn">{d.name}</span>
                <span className={`dst ${open.code}`}>{open.note || open.label}</span>
                <span className="dmeta">
                  走路 {walkMinFor(meters, config)} 分 · 距離約 {Math.round(meters)} 公尺 · {d.kind}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </>
  );
}
