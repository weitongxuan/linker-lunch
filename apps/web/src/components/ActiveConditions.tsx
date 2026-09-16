import { MOOD_TABLE } from '@lunch-map/shared';
import type { Service } from '@lunch-map/shared';
import { useFilters } from '../state/filtersStore.js';

type SetKey = 'cat' | 'excludeCat' | 'cuisine' | 'excludeCuisine' | 'service';
const SERVICE_LABEL: Record<Service, string> = { dine_in: '內用', takeout: '外帶', delivery: '外送' };

/**
 * 目前生效的條件,一眼看得到、一鍵清除。
 * 抽屜裡的「類別/今天不想吃」欄位拿掉之後,這裡是這些條件唯一的可見出口。
 */
export function ActiveConditions() {
  const { state, dispatch } = useFilters();
  const f = state.filters;

  const removeFrom = (key: SetKey, value: string) =>
    dispatch({ type: 'SET_SET_FILTER', key, values: [...f[key]].filter((v) => v !== value) });

  const chips: { key: string; text: string; onRemove: () => void }[] = [
    ...[...f.cuisine].map((v) => ({ key: `cu:${v}`, text: `想吃 ${v}`, onRemove: () => removeFrom('cuisine', v) })),
    ...[...f.cat].map((v) => ({ key: `c:${v}`, text: `想吃 ${v}`, onRemove: () => removeFrom('cat', v) })),
    ...[...f.excludeCuisine].map((v) => ({ key: `xcu:${v}`, text: `不吃 ${v}`, onRemove: () => removeFrom('excludeCuisine', v) })),
    ...[...f.excludeCat].map((v) => ({ key: `xc:${v}`, text: `不吃 ${v}`, onRemove: () => removeFrom('excludeCat', v) })),
    ...[...f.service].map((v) => ({ key: `sv:${v}`, text: SERVICE_LABEL[v] ?? v, onRemove: () => removeFrom('service', v) })),
  ];
  if (state.mood !== 'auto') chips.push({ key: 'mood', text: MOOD_TABLE[state.mood].label, onRemove: () => dispatch({ type: 'SET_MOOD', mood: 'auto' }) });
  if (f.minGoogle) chips.push({ key: 'g', text: `Google ${f.minGoogle.toFixed(1)}+`, onRemove: () => dispatch({ type: 'SET_MIN_GOOGLE', value: 0 }) });

  if (!chips.length) return null;

  const clearAll = () => {
    (['cat', 'excludeCat', 'cuisine', 'excludeCuisine', 'service'] as SetKey[]).forEach((k) => dispatch({ type: 'SET_SET_FILTER', key: k, values: [] }));
    dispatch({ type: 'SET_MOOD', mood: 'auto' });
    dispatch({ type: 'SET_MIN_GOOGLE', value: 0 });
  };

  return (
    <div className="conds" aria-label="目前條件">
      <span className="conds-lbl">目前條件</span>
      {chips.map((c) => (
        <span key={c.key} className="chip on">
          {c.text}
          <button className="conds-x" aria-label={`移除 ${c.text}`} onClick={c.onRemove}>
            ×
          </button>
        </span>
      ))}
      <button className="btn ghost" onClick={clearAll}>
        清除全部
      </button>
    </div>
  );
}
