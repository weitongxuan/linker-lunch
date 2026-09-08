import type { Row } from '../hooks/useComputedRows.js';
import { useFilters, type TravelMode } from '../state/FiltersContext.js';
import { useMarkEatenMutation } from '../hooks/useMutations.js';
import { useMe } from '../hooks/useMe.js';

interface Props {
  rows: Row[];
  onPickAgain: () => void;
  onViewOnMap: (shopId: string) => void;
}

export function PickCard({ rows, onPickAgain, onViewOnMap }: Props) {
  const { state, dispatch } = useFilters();
  const [me] = useMe();
  const eatenMut = useMarkEatenMutation('shop');

  if (state.pickEmpty) {
    return (
      <div id="pick">
        <div className="pickcard">
          <div>
            <div className="eyebrow">今天的推薦</div>
            <div className="sub">目前篩選條件下沒有吃得到的店 —— 先放寬篩選再試一次。</div>
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
          <div className="eyebrow">今天的推薦 · 抽中機率 {pct}%</div>
          <div className="who">{row.sh.name}</div>
          <div className="sub">
            {row.f.label} · {row.sh.category}
            {row.ate != null && row.ate < 7 ? ` · ${row.ate === 0 ? '今天吃過' : `${row.ate} 天前吃過`}` : ''}
          </div>
        </div>
        <span className="seg">
          {(['auto', 'walk', 'drive'] as TravelMode[]).map((m) => (
            <button key={m} className={state.mode === m ? 'on' : ''} onClick={() => { dispatch({ type: 'SET_MODE', mode: m }); onPickAgain(); }}>
              {m === 'auto' ? '全部' : m === 'walk' ? '走路' : '開車'}
            </button>
          ))}
        </span>
        <button className="btn" onClick={onPickAgain}>
          換一家
        </button>
        <button
          className="btn pri"
          onClick={() => {
            eatenMut.mutate({ placeId: row.sh.id, person: me || '訪客' });
            dispatch({ type: 'CLEAR_PICK' });
          }}
        >
          就這家,記錄下來
        </button>
        <button className="btn" onClick={() => onViewOnMap(row.sh.id)}>
          在地圖上看
        </button>
      </div>
    </div>
  );
}
