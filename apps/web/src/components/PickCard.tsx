import { findMenuItems } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';
import { googleDirectionsUrl } from '../lib/maps.js';
import { useFilters, type TravelMode } from '../state/filtersStore.js';

interface Props {
  rows: Row[];
  menus: Record<string, string>;
  onPickAgain: () => void;
  onViewOnMap: (shopId: string) => void;
}

export function PickCard({ rows, menus, onPickAgain, onViewOnMap }: Props) {
  const { state, dispatch } = useFilters();

  if (state.pickEmpty) {
    return (
      <div id="pick">
        <div className="pickcard">
          <div>
            <div className="eyebrow">今天的推薦</div>
            <div className="sub">
              {state.intentNote ? `「${state.intentNote}」之下` : '目前篩選條件下'}沒有吃得到的店 —— 先放寬篩選再試一次。
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!state.pickShopId || !state.pickWeights) return null;

  const row = rows.find((r) => r.sh.id === state.pickShopId);
  if (!row) return null;

  const pct = Math.round(((state.pickWeights.find((w) => w.shopId === row.sh.id)?.w ?? 0) / (state.pickTotal || 1)) * 100);

  return (
    <div id="pick">
      <div className="pickcard">
        <div>
          <div className="eyebrow">{state.intentNote ? `我理解為:${state.intentNote} · ` : '今天的推薦 · '}抽中機率 {pct}%</div>
          {state.intentReply && <div className="reply">{state.intentReply.replace('{shop}', row.sh.name)}</div>}
          <div className="who">{row.sh.name}</div>
          <div className="sub">
            {row.f.label} · {row.sh.category.join('、')}
          </div>
          {(() => {
            const hits = [...state.filters.dish].flatMap((d) => findMenuItems(menus[row.sh.id] ?? '', d, 2));
            return hits.length > 0 && <div className="menuhit">這家有:{[...new Set(hits)].slice(0, 3).join('、')}</div>;
          })()}
        </div>
        <span className="seg">
          {(['walk', 'drive'] as TravelMode[]).map((m) => (
            <button key={m} className={state.mode === m ? 'on' : ''} onClick={() => dispatch({ type: 'SET_MODE', mode: m, repick: true })}>
              {m === 'walk' ? '走路' : '開車'}
            </button>
          ))}
        </span>
        <button className="btn" onClick={onPickAgain}>
          換一家
        </button>
        <button className="btn pri" onClick={() => dispatch({ type: 'CLEAR_PICK' })}>
          就這家
        </button>
        <button className="btn" onClick={() => onViewOnMap(row.sh.id)}>
          在地圖上看
        </button>
        <a className="btn nav" href={googleDirectionsUrl(row.sh, row.by)} target="_blank" rel="noopener noreferrer">
          🧭 Google 導航
        </a>
      </div>
    </div>
  );
}
