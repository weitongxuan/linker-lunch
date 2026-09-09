import type { Config } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';
import { ShopCard } from './ShopCard.js';

interface Props {
  allRows: Row[];
  visibleRows: Row[];
  config: Config;
  windowStart: number;
  menus: Record<string, string>;
}

export function ShopList({ allRows, visibleRows, config, windowStart, menus }: Props) {
  const okCount = allRows.filter((r) => r.f.code === 'ok').length;
  const tightCount = allRows.filter((r) => r.f.code === 'tight').length;
  const unknownCount = allRows.filter((r) => r.f.code === 'unknown').length;
  const notTodayCount = allRows.filter((r) => ['not_enough', 'not_lunch', 'closed', 'no_time'].includes(r.f.code)).length;
  const outOfRangeCount = allRows.filter((r) => r.f.code === 'out_of_range' || r.tier === 'far').length;

  return (
    <>
      <div className="sum" id="count">
        <b>{okCount}</b> 家吃得到
        <span className="dot">·</span>
        <b>{tightCount}</b> 家得晚出門
        {unknownCount > 0 && (
          <>
            <span className="dot">·</span>
            <span className="warn">
              <b>{unknownCount}</b> 家時間未知
            </span>
          </>
        )}
        {notTodayCount > 0 && (
          <>
            <span className="dot">·</span>
            <b>{notTodayCount}</b> 家今天不行
          </>
        )}
        {outOfRangeCount > 0 && (
          <>
            <span className="dot">·</span>
            <span className="warn">
              <b>{outOfRangeCount}</b> 家超出範圍
            </span>
          </>
        )}
      </div>
      <div id="list">
        {visibleRows.length === 0 && <div className="hint">目前的篩選條件下沒有店家 —— 試試看放寬篩選。</div>}
        {visibleRows.map((row) => (
          <ShopCard
            key={row.sh.id}
            row={row}
            config={config}
            windowStart={windowStart}
            menuText={menus[row.sh.id] ?? ''}
          />
        ))}
      </div>
    </>
  );
}
