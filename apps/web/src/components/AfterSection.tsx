import { useMemo } from 'react';
import { openNowState, passScore, tierOf, travelOf } from '@lunch-map/shared';
import type { AfterPlace, Config, DayKey, Parking } from '@lunch-map/shared';
import { useMe } from '../hooks/useMe.js';
import { useDeleteDrinkMutation, useRateMutation } from '../hooks/useMutations.js';
import { useFilters } from '../state/filtersStore.js';

interface RatingMap {
  [placeId: string]: { avg: number; n: number; who?: Record<string, number> };
}

interface Props {
  title: string;
  items: AfterPlace[];
  config: Config;
  parkings: Parking[];
  day: DayKey;
  nowMinute: number;
  ratings: RatingMap;
}

export function AfterSection({ title, items, config, parkings, day, nowMinute, ratings }: Props) {
  const { state, dispatch } = useFilters();
  const [me] = useMe();
  const rateMut = useRateMutation('drink');
  const deleteDrinkMut = useDeleteDrinkMutation();

  const rows = useMemo(() => {
    return items
      .map((d) => {
        const t = travelOf(d, parkings, config);
        const tier = tierOf(t, config);
        const open = openNowState(d, day, nowMinute);
        const sc = ratings[d.id] ?? { avg: 0, n: 0 };
        return { d, t, tier, open, sc };
      })
      .filter((r) => r.tier !== 'far' && passScore({ sh: r.d, sc: r.sc }, state.filters))
      .sort((a, b) => {
        const order = { open: 0, later: 1, unknown: 2, closed: 3, out_of_range: 4 } as const;
        return order[a.open.code] - order[b.open.code] || a.t.walk - b.t.walk || a.d.name.localeCompare(b.d.name, 'zh-Hant');
      });
  }, [items, parkings, config, day, nowMinute, ratings, state.filters]);

  if (rows.length === 0) return null;

  const openCount = rows.filter((r) => r.open.code === 'open').length;
  const isOpen = state.secOpen.drinks;

  return (
    <div>
      <div className="dhead">
        <span className="dtitle">{title}</span>
        <span className="dsub">
          現在有開 <b>{openCount}</b>/{rows.length} 家
        </span>
        <button className="btn" onClick={() => dispatch({ type: 'TOGGLE_SEC_OPEN', key: 'drinks' })}>
          {isOpen ? '收起' : '展開'}
        </button>
      </div>
      {(isOpen ? rows : []).map((r) => (
        <div key={r.d.id} className={`drow${r.open.code === 'closed' ? ' dim' : ''}`}>
          <span className="dn">{r.d.name}</span>
          <span className={`dst ${r.open.code}`}>{r.open.note || r.open.label}</span>
          <span className="dmeta">
            走路 {r.t.walk} 分 · {r.d.kind}
            {r.d.note ? ` · ${r.d.note}` : ''}
            {r.sc.n > 0 ? ` · ★${r.sc.avg.toFixed(1)}` : ''}
            {r.d.googleRating != null ? ` · G ${r.d.googleRating.toFixed(1)}` : ''}
          </span>
          <span className="dstars">
            {[1, 2, 3, 4, 5].map((s) => {
              const mine = ratings[r.d.id]?.who?.[me] ?? 0;
              return (
                <b
                  key={s}
                  className={s <= mine ? 'f' : ''}
                  onClick={() => rateMut.mutate({ placeId: r.d.id, person: me || '訪客', score: s === mine ? 0 : s })}
                >
                  ★
                </b>
              );
            })}
          </span>
          <span className="dacts">
            <button className="btn ghost" onClick={() => dispatch({ type: 'SET_EDIT_DRINK', id: r.d.id })}>
              ✏️ 修改
            </button>
            <button
              className="btn ghost"
              disabled={deleteDrinkMut.isPending}
              onClick={() => {
                if (window.confirm(`確定要刪除「${r.d.name}」嗎?此動作無法復原。`)) deleteDrinkMut.mutate(r.d.id);
              }}
            >
              🗑 刪除
            </button>
          </span>
        </div>
      ))}
    </div>
  );
}
