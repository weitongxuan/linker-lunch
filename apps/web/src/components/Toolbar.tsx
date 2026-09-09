import { currentMood, MOOD_TABLE } from '@lunch-map/shared';
import type { Config, Market } from '@lunch-map/shared';
import { useFilters, type TravelMode } from '../state/FiltersContext.js';

interface Props {
  config: Config | undefined;
  market: Market | null;
  onRandomPick: () => void;
  onOpenAddShop: () => void;
}

export function Toolbar({ config, market, onRandomPick, onOpenAddShop }: Props) {
  const { state, dispatch } = useFilters();
  const f = state.filters;

  const activeFilterCount =
    f.tier.size +
    f.cat.size +
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

  const departLabel = config ? `${config.depart.start}–${config.depart.end}` : '出門';
  const planText = !config
    ? ''
    : state.useNow
      ? `現在出門,${config.backBy} 前要回來`
      : `預計 ${config.depart.start} 出門,${config.backBy} 前回來`;

  return (
    <div className="bar1">
      <span className="seg">
        {(['auto', 'walk', 'drive'] as TravelMode[]).map((m) => (
          <button
            key={m}
            className={state.mode === m ? 'on' : ''}
            onClick={() => dispatch({ type: 'SET_MODE', mode: m })}
          >
            {m === 'auto' ? '全部' : m === 'walk' ? '走路' : '開車'}
          </button>
        ))}
      </span>
      <span className="seg">
        <button className={!state.useNow ? 'on' : ''} onClick={() => dispatch({ type: 'SET_USE_NOW', value: false })}>
          {departLabel}
        </button>
        <button className={state.useNow ? 'on' : ''} onClick={() => dispatch({ type: 'SET_USE_NOW', value: true })}>
          現在出門
        </button>
      </span>
      <span className="plan">{planText}</span>
      <span className="spacer" />
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
    </div>
  );
}
