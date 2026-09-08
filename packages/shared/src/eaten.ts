/** dates 是 "YYYY-MM-DD" 字串陣列;回傳離現在最近一次吃過的天數,沒吃過回傳 null */
export function daysSinceEaten(dates: string[], now: Date = new Date()): number | null {
  if (!dates.length) return null;
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  let min = Infinity;
  for (const d of dates) {
    const [y, m, day] = d.split('-').map(Number);
    const t = new Date(y, m - 1, day).getTime();
    const diff = Math.round((nowMidnight - t) / 86400000);
    if (diff < min) min = diff;
  }
  return Number.isFinite(min) ? min : null;
}
