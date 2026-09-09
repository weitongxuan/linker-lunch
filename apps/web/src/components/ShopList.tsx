import { useMemo } from 'react';
import { haversine, openNowState, walkMinFor } from '@lunch-map/shared';
import type { AfterPlace, Config, DayKey } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';
import { useFilters } from '../state/FiltersContext.js';
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

export function ShopList({ visibleRows, config, menus, drinks, day, nowMinute, onSelectOnMap }: Props) {
  const { state } = useFilters();

  const selectedRow = state.sel ? (visibleRows.find((r) => r.sh.id === state.sel) ?? null) : null;

  const orderedRows = selectedRow
    ? [selectedRow, ...visibleRows.filter((r) => r.sh.id !== selectedRow.sh.id)]
    : visibleRows;

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
        {orderedRows.map((row) => (
          <ShopCard
            key={row.sh.id}
            row={row}
            config={config}
            menuText={menus[row.sh.id] ?? ''}
            onSelectOnMap={onSelectOnMap}
            className={selectedRow && row.sh.id !== selectedRow.sh.id ? 'fadeout' : undefined}
          />
        ))}
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
