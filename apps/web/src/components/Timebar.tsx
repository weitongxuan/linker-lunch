import { toMin } from '@lunch-map/shared';
import type { Config, DayKey } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';

interface Props {
  config: Config;
  day: DayKey;
  windowStart: number;
  row: Row;
}

function fmt(m: number): string {
  const v = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${String(Math.floor(v / 60)).padStart(2, '0')}:${String(v % 60).padStart(2, '0')}`;
}

/** 午休時間軸 —— 卡片的主角。用 % 定位畫出:開店時段、去程/回程交通、可用吃飯時間、尖峰時段。 */
export function Timebar({ config, day, windowStart, row }: Props) {
  const windowEnd = toMin(config.backBy);
  const total = Math.max(1, windowEnd - windowStart);
  const pct = (m: number) => Math.min(100, Math.max(0, ((m - windowStart) / total) * 100));
  const { sh, f } = row;

  const segs: { cls: string; left: number; width: number; style?: React.CSSProperties; key: string }[] = [];

  if (f.code === 'unknown') {
    segs.push({ cls: 'tb-unknown', left: 0, width: 100, key: 'unknown' });
  }

  const dayHours = sh.hours[day] || [];
  dayHours.forEach(([openS, closeS], i) => {
    let os = toMin(openS);
    let oe = toMin(closeS);
    if (oe <= os) oe += 1440;
    const s = Math.max(os, windowStart);
    const e = Math.min(oe, windowEnd);
    if (e > s) segs.push({ cls: 'tb-open', left: pct(s), width: pct(e) - pct(s), key: `open${i}` });
  });

  const travelMin = f.travelMin;
  if (travelMin != null) {
    segs.push({ cls: 'tb-go', left: pct(windowStart), width: pct(windowStart + travelMin) - pct(windowStart), key: 'go' });
    segs.push({
      cls: 'tb-back',
      left: pct(windowEnd - travelMin),
      width: pct(windowEnd) - pct(windowEnd - travelMin),
      key: 'back',
    });

    if (f.seg && windowStart + travelMin < f.seg.os) {
      segs.push({
        cls: 'tb-wait',
        left: pct(windowStart + travelMin),
        width: pct(f.seg.os) - pct(windowStart + travelMin),
        key: 'wait',
      });
    }
  }

  if (f.seg) {
    const barVar = f.code === 'ok' ? '--okbar' : f.code === 'tight' ? '--tightbar' : '--nobar';
    segs.push({
      cls: 'tb-eat',
      left: pct(f.seg.os),
      width: pct(f.seg.oe) - pct(f.seg.os),
      style: { background: `var(${barVar})` },
      key: 'eat',
    });
  }

  if (sh.peak) {
    const pf = Math.max(toMin(sh.peak.from), windowStart);
    const pt = Math.min(toMin(sh.peak.to), windowEnd);
    if (pt > pf) segs.push({ cls: 'tb-peak', left: pct(pf), width: pct(pt) - pct(pf), key: 'peak' });
  }

  const ticks: number[] = [];
  for (let t = Math.ceil(windowStart / 30) * 30; t <= windowEnd; t += 30) ticks.push(t);

  const title = f.seg ? `可用 ${fmt(f.seg.os)}–${fmt(f.seg.oe)}` : f.label;

  return (
    <div className="tl">
      <span className="track-cap">{fmt(windowStart)}</span>
      <span className="track" title={title}>
        {segs.map((s) => (
          <i key={s.key} className={s.cls} style={{ left: `${s.left}%`, width: `${s.width}%`, ...s.style }} />
        ))}
        {ticks.map((t) => (
          <u key={t} style={{ left: `${pct(t)}%` }} />
        ))}
      </span>
      <span className="track-cap">{fmt(windowEnd)}</span>
    </div>
  );
}
