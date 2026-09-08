import { useMemo } from 'react';
import { openNowState, tierOf, travelOf } from '@lunch-map/shared';
import type { AfterPlace, Config, DayKey, Parking } from '@lunch-map/shared';
import { useMe } from '../hooks/useMe.js';
import { useRateMutation } from '../hooks/useMutations.js';
import { useFilters } from '../state/FiltersContext.js';

interface RatingMap {
  [placeId: string]: { avg: number; n: number; who?: Record<string, number> };
}

interface Props {
  sectionKey: 'desserts' | 'drinks';
  title: string;
  items: AfterPlace[];
  config: Config;
  parkings: Parking[];
  day: DayKey;
  nowMinute: number;
  ratings: RatingMap;
}

export function AfterSection({ sectionKey, title, items, config, parkings, day, nowMinute, ratings }: Props) {
  const { state, dispatch } = useFilters();
  const [me] = useMe();
  const placeType = sectionKey === 'desserts' ? 'dessert' : 'drink';
  const rateMut = useRateMutation(placeType);

  const rows = useMemo(() => {
    return items
      .map((d) => {
        const t = travelOf(d, parkings, config);
        const tier = tierOf(t, config);
        const open = openNowState(d, day, nowMinute);
        const sc = ratings[d.id] ?? { avg: 0, n: 0 };
        return { d, t, tier, open, sc };
      })
      .filter((r) => r.tier !== 'far')
      .sort((a, b) => {
        const order = { open: 0, later: 1, unknown: 2, closed: 3 } as const;
        return order[a.open.code] - order[b.open.code] || a.t.walk - b.t.walk || a.d.name.localeCompare(b.d.name, 'zh-Hant');
      });
  }, [items, parkings, config, day, nowMinute, ratings]);

  if (rows.length === 0) return null;

  const openCount = rows.filter((r) => r.open.code === 'open').length;
  const isOpen = state.secOpen[sectionKey];

  return (
    <div>
      <div className="dhead">
        <span className="dtitle">{title}</span>
        <span className="dsub">
          現在有開 <b>{openCount}</b>/{rows.length} 家
        </span>
        <button className="btn" onClick={() => dispatch({ type: 'TOGGLE_SEC_OPEN', key: sectionKey })}>
          {isOpen ? '收起' : '展開'}
        </button>
      </div>
      {isOpen &&
        rows.map((r) => (
          <div key={r.d.id} className={`drow${r.open.code === 'closed' ? ' dim' : ''}`}>
            <span className="dn">{r.d.name}</span>
            <span className={`dst ${r.open.code}`}>{r.open.note || r.open.label}</span>
            <span className="dmeta">
              走路 {r.t.walk} 分 · {r.d.kind}
              {r.d.note ? ` · ${r.d.note}` : ''}
              {r.sc.n > 0 ? ` · ★${r.sc.avg.toFixed(1)}` : ''}
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
          </div>
        ))}
    </div>
  );
}
