import { fmt, toMin } from './time.js';
import { LABEL } from './types.js';
import type { Config, DayKey, Feasibility, Shop } from './types.js';

interface Seg {
  os: number;
  oe: number;
  len: number;
}

/**
 * 午餐可行性核心判斷。
 * 模型:可用時間窗 = [出門時間+單程交通, backBy-單程交通],跟當天營業時段取交集,
 * 交集長度 >= eatMinutes 才算吃得到。
 *
 * 回傳的 code 只會是這六種之一(out_of_range / temp / unknown 是上游 computeAll 疊加的):
 * no_time / closed / not_lunch / not_enough / tight / ok
 */
export function feasibility(
  shop: Shop,
  dayKey: DayKey,
  travelMin: number,
  departStart: number,
  departEnd: number,
  cfg: Config,
): Feasibility {
  const back = toMin(cfg.backBy);
  const winS = departStart + travelMin;
  const winE = back - travelMin;
  const arriveLatest = departEnd + travelMin;

  if (winE - winS < cfg.eatMinutes) {
    return {
      code: 'no_time',
      label: '來回就用掉午休',
      why: `光是來回交通就要 ${travelMin * 2} 分鐘,已經超過午休時間。`,
      travelMin,
      winS,
      winE,
    };
  }

  const dayHours = shop.hours[dayKey] || [];
  if (dayHours.length === 0) {
    return {
      code: 'closed',
      label: '今天公休',
      why: shop.closedNote || `${LABEL[dayKey]}固定公休。`,
      travelMin,
      winS,
      winE,
    };
  }

  const segs: Seg[] = [];
  for (const [openS, closeS] of dayHours) {
    let os = toMin(openS);
    let oe = toMin(closeS);
    if (oe <= os) oe += 1440;
    const s = Math.max(os, winS);
    const e = Math.min(oe, winE);
    if (e > s) segs.push({ os, oe, len: e - s });
  }

  if (segs.length === 0) {
    const opens = dayHours.map(([o]) => toMin(o));
    const lastClose = Math.max(...dayHours.map(([o, c]) => {
      let os = toMin(o), oe = toMin(c);
      if (oe <= os) oe += 1440;
      return oe;
    }));
    const firstOpen = Math.min(...opens);
    let why: string;
    if (lastClose <= winS) {
      why = `今天有開,但 ${fmt(lastClose)} 就收攤,你最快 ${fmt(winS)} 才到得了。`;
    } else if (firstOpen >= winE) {
      why = `今天有開,但 ${fmt(firstOpen)} 才開門,午休來不及。`;
    } else {
      const hoursTxt = dayHours.map(([o, c]) => `${o}-${c}`).join('、');
      why = `今天有開,但中午這段休息。營業:${hoursTxt}`;
    }
    return { code: 'not_lunch', label: '午餐時段不營業', why, travelMin, winS, winE };
  }

  segs.sort((a, b) => b.len - a.len);
  const best = segs[0];
  const suggestDepart = Math.max(departStart, best.os - travelMin);
  const latestDepart = best.oe - cfg.eatMinutes - travelMin;

  if (best.len < cfg.eatMinutes) {
    return {
      code: 'not_enough',
      label: '時間不夠',
      why: `扣掉交通,中午最多只剩 ${best.len} 分鐘可以用餐,不到 ${cfg.eatMinutes} 分鐘。`,
      travelMin,
      winS,
      winE,
      seg: best,
      usable: best.len,
    };
  }

  const lateOpen = best.os > arriveLatest;
  let why = lateOpen
    ? `得比平常晚一點出門 —— ${fmt(suggestDepart)} 出門才吃得到,最晚 ${fmt(latestDepart)} 出門還來得及。`
    : `建議 ${fmt(suggestDepart)} 出門,最晚 ${fmt(latestDepart)} 出門還吃得到。`;
  if (best.len < cfg.eatMinutes + 10) why += '　時間有點趕。';

  return {
    code: lateOpen ? 'tight' : 'ok',
    label: lateOpen ? '得晚點出門' : '吃得到',
    why,
    travelMin,
    winS,
    winE,
    seg: best,
    usable: best.len,
    suggestDepart,
    latestDepart,
  };
}

export interface PeakHint {
  hit: boolean;
  leaveBy?: number;
  afterHint?: number;
}

/** 尖峰時段提示(非狀態碼,純建議):算出的抵達時間若落在 shop.peak 窗內就提醒 */
export function peakHint(shop: Shop, f: Feasibility): PeakHint | null {
  if (!shop.peak || !f.seg || f.winS == null) return null;
  const pf = toMin(shop.peak.from);
  const pt = toMin(shop.peak.to);
  const arrive = Math.max(f.winS, f.seg.os);
  const hit = arrive < pt && arrive >= pf - 5;
  if (!hit) return { hit: false };
  return {
    hit: true,
    leaveBy: pf - 10 - (f.travelMin ?? 0),
    afterHint: pt,
  };
}
