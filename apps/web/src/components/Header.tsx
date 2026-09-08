import { LABEL, TABS } from '@lunch-map/shared';
import type { Config } from '@lunch-map/shared';
import { useClock } from '../hooks/useClock.js';
import { useMe } from '../hooks/useMe.js';
import { useFilters } from '../state/FiltersContext.js';

function fmtClock(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function Header({ config }: { config: Config | undefined }) {
  const now = useClock();
  const [me, setMe] = useMe();
  const { state, dispatch } = useFilters();

  return (
    <header>
      <div className="hrow">
        <h1>午餐地圖</h1>
        <span className="where">{config?.office.name ?? ''}</span>
        <span className="clock">{fmtClock(now)}</span>
        <span className="me">
          我是{' '}
          <input
            value={me}
            maxLength={10}
            placeholder="你的名字"
            onChange={(e) => setMe(e.target.value)}
          />
        </span>
      </div>
      <div className="tabs">
        {TABS.map((day) => (
          <button
            key={day}
            className={`tab${state.day === day ? ' on' : ''}`}
            onClick={() => dispatch({ type: 'SET_DAY', day })}
          >
            {LABEL[day]}
          </button>
        ))}
      </div>
    </header>
  );
}
