import { useMemo, useState } from 'react';
import { SERVICE_LABEL } from '@lunch-map/shared';
import type { Config, Service, Shop, Tier } from '@lunch-map/shared';
import { useFilters, type SetFilterKey, type SortKey } from '../state/filtersStore.js';
import { useImportOsmParkingsMutation, useImportOsmShopsMutation, useRefreshMarketMutation } from '../hooks/useMutations.js';

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

export function FilterDrawer({ config, shops, ratings, onCopyList }: Props) {
  const { state, dispatch } = useFilters();
  const f = state.filters;
  const importShops = useImportOsmShopsMutation();
  const importParkings = useImportOsmParkingsMutation();
  const refreshMarketMut = useRefreshMarketMutation();
  const [dishText, setDishText] = useState('');
  const [drinkText, setDrinkText] = useState('');
  const [openRow, setOpenRow] = useState<'cat' | 'excludeCat' | null>(null);

  const ratedInfo = useMemo(() => {
    const total = shops.length;
    const rated = shops.filter((s) => (ratings[s.id]?.n ?? 0) > 0).length;
    return `${rated}/${total} 家有人評分`;
  }, [shops, ratings]);

  // 類別與菜系都從資料長出來,跟問問看用同一份詞彙;問問看套了什麼,這裡就亮什麼
  const vocab = useMemo(() => {
    const catCount = new Map<string, number>();
    const cuiCount = new Map<string, number>();
    for (const s of shops) {
      for (const c of s.category) catCount.set(c, (catCount.get(c) ?? 0) + 1);
      if (s.cuisine) cuiCount.set(s.cuisine, (cuiCount.get(s.cuisine) ?? 0) + 1);
    }
    const byCount = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'zh-Hant')).map(([k]) => k);
    return { cats: byCount(catCount), cuisines: byCount(cuiCount) };
  }, [shops]);

  if (!state.filterDrawerOpen) return null;

  // 想吃/不吃各自有十幾個類別+菜系,全攤開會佔半個畫面:平常只顯示選了的,按「選 ▾」才展開全部
  const wantRow = (label: string, catKey: 'cat' | 'excludeCat', cuiKey: 'cuisine' | 'excludeCuisine', onCls: string) => {
    const expanded = openRow === catKey;
    const chosen = [...[...f[catKey]].map((v) => [catKey, v] as const), ...[...f[cuiKey]].map((v) => [cuiKey, v] as const)];
    const chip = (key: typeof catKey | typeof cuiKey, c: string) => (
      <button
        key={`${key}:${c}`}
        className={`chip${f[key].has(c) ? ` on ${onCls}` : ''}`}
        onClick={() => dispatch({ type: 'TOGGLE_SET_FILTER', key, value: c })}
      >
        {c}
      </button>
    );
    return (
      <div className="crow">
        <span className="lbl">{label}</span>
        {expanded ? (
          <>
            {vocab.cats.map((c) => chip(catKey, c))}
            {vocab.cuisines.length > 0 && <span className="lbl auto">菜系</span>}
            {vocab.cuisines.map((c) => chip(cuiKey, c))}
          </>
        ) : chosen.length ? (
          chosen.map(([k, v]) => chip(k, v))
        ) : (
          <span className="hint">不限</span>
        )}
        <button className="btn ghost fold" aria-expanded={expanded} onClick={() => setOpenRow(expanded ? null : catKey)}>
          {expanded ? '收起 ▴' : '選 ▾'}
        </button>
      </div>
    );
  };

  // 問問看說「想吃蝦仁飯 / 想喝珍奶」會亮在這裡;這裡手動加的也一樣會拿去比對菜單
  const termRow = (label: string, key: Extract<SetFilterKey, 'dish' | 'drink'>, text: string, setText: (v: string) => void, ph: string) => {
    const add = () => {
      const v = text.trim();
      if (v && !f[key].has(v)) dispatch({ type: 'TOGGLE_SET_FILTER', key, value: v });
      setText('');
    };
    return (
      <>
        <span className={`lbl${key === 'drink' ? ' auto' : ''}`}>{label}</span>
        {[...f[key]].map((v) => (
          <span key={v} className="chip on">
            {v}
            <button className="conds-x" aria-label={`移除 ${v}`} onClick={() => dispatch({ type: 'TOGGLE_SET_FILTER', key, value: v })}>
              ×
            </button>
          </span>
        ))}
        <input
          className="terminput"
          type="text"
          value={text}
          placeholder={ph}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') add();
          }}
          onBlur={add}
        />
      </>
    );
  };

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
        <span className="lbl">預算</span>
        <span className="seg">
          {[0, 100, 150, 200, 300].map((b) => (
            <button key={b} className={f.budget === b ? 'on' : ''} onClick={() => dispatch({ type: 'SET_BUDGET', value: b })}>
              {b === 0 ? '不限' : `${b} 內`}
            </button>
          ))}
        </span>
        <span className="hint">看菜單,至少 3 樣在預算內才留下;菜單沒標價的店不會被刷掉</span>
      </div>

      <div className="crow">
        {termRow('想吃的菜', 'dish', dishText, setDishText, '例如 蝦仁飯')}
        {termRow('想喝', 'drink', drinkText, setDrinkText, '例如 珍珠奶茶')}
      </div>

      {wantRow('想吃', 'cat', 'cuisine', 'want')}
      {wantRow('不吃', 'excludeCat', 'excludeCuisine', 'avoid')}

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
