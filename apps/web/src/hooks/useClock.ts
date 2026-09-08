import { useEffect, useState } from 'react';

/** 每 30 秒 tick 一次的時鐘,驅動 header 時間與「現在出門」模式的即時可行性重算。 */
export function useClock(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
