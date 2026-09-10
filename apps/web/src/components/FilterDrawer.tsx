import { useEffect, useMemo, useState } from 'react';
import type { Config, Service, Shop, Tier } from '@lunch-map/shared';
import { useFilters, type SortKey } from '../state/filtersStore.js';
import { useImportOsmParkingsMutation, useImportOsmShopsMutation, useRefreshMarketMutation } from '../hooks/useMutations.js';

const CAT_INPUT_DEBOUNCE_MS = 400;

/** 逗號/空白分隔的關鍵字,對照已知類別做「包含」比對(不分大小寫),回傳有命中的類別名稱。 */
function matchCategories(text: string, known: string[]): string[] {
  const terms = text
    .split(/[,、，\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
  if (!terms.length) return [];
  return known.filter((cat) => terms.some((t) => cat.toLowerCase().includes(t)));
}

interface RatingMap {
  [placeId: string]: { avg: number; n: number };
}

interface Props {
  config: Config | undefined;
  shops: Shop[];
  ratings: RatingMap;
  onCopyList: () => void;
}

const TIER_LABEL: Record<Exclude<Tier, 'far'>, string> = {
  w5: '走路 5 分內',
  w10: '走路 10 分內',
  d10: '開車 10 分內',
};

const SERVICE_LABEL: Record<Service, string> = {
  dine_in: '內用',
  takeout: '外帶',
  delivery: '外送',
};

export function FilterDrawer({ config, shops, ratings, onCopyList }: Props) {
  const { state, dispatch } = useFilters();
  const f = state.filters;
  const importShops = useImportOsmShopsMutation();
  const importParkings = useImportOsmParkingsMutation();
  const refreshMarketMut = useRefreshMarketMutation();

  const categories = useMemo(() => {
    const set = new Set(shops.flatMap((s) => (s.category.length ? s.category : ['其他'])));
    return [...set].sort((a, b) => a.localeCompare(b, 'zh-Hant'));
  }, [shops]);

  const [catText, setCatText] = useState(() => [...f.cat].join('、'));
  const [excludeCatText, setExcludeCatText] = useState(() => [...f.excludeCat].join('、'));

  useEffect(() => {
    const id = setTimeout(() => {
      dispatch({ type: 'SET_SET_FILTER', key: 'cat', values: matchCategories(catText, categories) });
    }, CAT_INPUT_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only debounce on local text changes
  }, [catText, categories]);

  useEffect(() => {
    const id = setTimeout(() => {
      dispatch({ type: 'SET_SET_FILTER', key: 'excludeCat', values: matchCategories(excludeCatText, categories) });
    }, CAT_INPUT_DEBOUNCE_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only debounce on local text changes
  }, [excludeCatText, categories]);

  const ratedInfo = useMemo(() => {
    const total = shops.length;
    const rated = shops.filter((s) => (ratings[s.id]?.n ?? 0) > 0).length;
    return `${rated}/${total} 家有人評分`;
  }, [shops, ratings]);

  if (!state.filterDrawerOpen) return null;

  return (
    <div className="drawer">
      <div className="crow">
        <span className="lbl">距離</span>
        {(['w5', 'w10', 'd10'] as const).map((tier) => (
          <button
            key={tier}
            className={`chip${f.tier.has(tier) ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_SET_FILTER', key: 'tier', value: tier })}
          >
            {TIER_LABEL[tier]}
          </button>
        ))}
        <span className="lbl auto">狀態</span>
        <button
          className={`chip${f.onlyOpen ? ' on' : ''}`}
          onClick={() => dispatch({ type: 'SET_BOOL_FILTER', key: 'onlyOpen', value: !f.onlyOpen })}
        >
          只看吃得到的
        </button>
        <button
          className={`chip${f.showUnknown ? ' on' : ''}`}
          onClick={() => dispatch({ type: 'SET_BOOL_FILTER', key: 'showUnknown', value: !f.showUnknown })}
        >
          時間未知的也列出
        </button>
      </div>

      <div className="crow">
        <span className="lbl">評分</span>
        <button
          className={`chip${f.hideBad ? ' on' : ''}`}
          onClick={() => dispatch({ type: 'SET_BOOL_FILTER', key: 'hideBad', value: !f.hideBad })}
        >
          排除評分差的
        </button>
        <span className="seg">
          {[0, 3, 4].map((s) => (
            <button key={s} className={f.minScore === s ? 'on' : ''} onClick={() => dispatch({ type: 'SET_MIN_SCORE', value: s })}>
              {s === 0 ? '不限' : `★${s} 以上`}
            </button>
          ))}
        </span>
        <button
          className={`chip${f.hideUnrated ? ' on' : ''}`}
          onClick={() => dispatch({ type: 'SET_BOOL_FILTER', key: 'hideUnrated', value: !f.hideUnrated })}
        >
          連沒人評的也不看
        </button>
        <span className="lbl auto">Google</span>
        <span className="seg">
          {[0, 3.5, 4, 4.3].map((g) => (
            <button key={g} className={f.minGoogle === g ? 'on' : ''} onClick={() => dispatch({ type: 'SET_MIN_GOOGLE', value: g })}>
              {g === 0 ? '不限' : `${g.toFixed(1)}+`}
            </button>
          ))}
        </span>
        <span className="hint">{ratedInfo}</span>
      </div>

      <datalist id="cat-options">
        {categories.map((cat) => (
          <option key={cat} value={cat} />
        ))}
      </datalist>

      <div className="crow">
        <span className="lbl">類別</span>
        <input
          className="catinput"
          list="cat-options"
          value={catText}
          onChange={(e) => setCatText(e.target.value)}
          placeholder="輸入想吃的類別,逗號分隔,例如:麵、飯"
        />
        {f.cat.size > 0 && <span className="hint">符合:{[...f.cat].join('、')}</span>}
      </div>

      <div className="crow">
        <span className="lbl">今天不想吃</span>
        <input
          className="catinput exclude"
          list="cat-options"
          value={excludeCatText}
          onChange={(e) => setExcludeCatText(e.target.value)}
          placeholder="輸入不想吃的類別,逗號分隔,例如:便當"
        />
        {f.excludeCat.size > 0 && <span className="hint">已排除:{[...f.excludeCat].join('、')}</span>}
      </div>

      <div className="crow">
        <span className="lbl">價位</span>
        {(config?.priceBands ?? []).map((band) => (
          <button
            key={band.v}
            className={`chip${f.price.has(String(band.v)) ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_SET_FILTER', key: 'price', value: String(band.v) })}
          >
            {band.label}
          </button>
        ))}
        <span className="lbl auto">服務</span>
        {(['dine_in', 'takeout', 'delivery'] as Service[]).map((sv) => (
          <button
            key={sv}
            className={`chip${f.service.has(sv) ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'TOGGLE_SET_FILTER', key: 'service', value: sv })}
          >
            {SERVICE_LABEL[sv]}
          </button>
        ))}
      </div>

      <div className="crow">
        <span className="lbl">行情</span>
        <span className="seg">
          {(['auto', 'up', 'flat', 'down'] as const).map((m) => (
            <button key={m} className={state.mood === m ? 'on' : ''} onClick={() => dispatch({ type: 'SET_MOOD', mood: m })}>
              {m === 'auto' ? '自動' : m === 'up' ? '加菜' : m === 'flat' ? '平盤' : '省一點'}
            </button>
          ))}
        </span>
      </div>

      <div className="crow">
        <span className="lbl">排序</span>
        <select
          className="btn"
          value={state.sort}
          onChange={(e) => dispatch({ type: 'SET_SORT', sort: e.target.value as SortKey })}
        >
          <option value="travel">交通時間</option>
          <option value="score">大家的評分</option>
          <option value="votes">票數</option>
        </select>
        <button className="btn" onClick={onCopyList}>
          📋 複製候選清單
        </button>
        <span className="spacer" />
        <button className="btn ghost" disabled={importShops.isPending} onClick={() => importShops.mutate()}>
          {importShops.isPending ? '匯入中…' : '從 OSM 匯入店家'}
        </button>
        <button className="btn ghost" disabled={importParkings.isPending} onClick={() => importParkings.mutate()}>
          {importParkings.isPending ? '匯入中…' : '從 OSM 匯入停車場'}
        </button>
        <button className="btn ghost" disabled={refreshMarketMut.isPending} onClick={() => refreshMarketMut.mutate()}>
          更新行情
        </button>
      </div>
    </div>
  );
}
