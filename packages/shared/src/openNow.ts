import { fmt, toMin } from './time.js';
import type { AfterPlace, DayKey, OpenNowState } from './types.js';

/**
 * 飲料/甜點用的「現在有沒有開」判斷 —— 跟 shops 的 feasibility() 不同,
 * 不管交通時間或午餐時段,只管「這一刻」是否營業(因為是吃飽飯才去買的)。
 */
export function openNowState(d: AfterPlace, dayKey: DayKey, nowMinute: number): OpenNowState {
  if (d.hoursUnknown) return { code: 'unknown', label: '時間未知' };
  const ranges = (d.hours[dayKey] || []).slice().sort((a, b) => toMin(a[0]) - toMin(b[0]));
  if (ranges.length === 0) return { code: 'closed', label: '今天公休' };

  for (const [openS, closeS] of ranges) {
    const a = toMin(openS);
    let b = toMin(closeS);
    if (b <= a) b += 1440;
    if (nowMinute >= a && nowMinute < b) {
      return { code: 'open', label: '營業中', note: `開到 ${fmt(b)}` };
    }
  }
  const next = ranges.find(([openS]) => toMin(openS) > nowMinute);
  if (next) return { code: 'later', label: `${next[0]} 才開` };
  return { code: 'closed', label: '今天已打烊' };
}
