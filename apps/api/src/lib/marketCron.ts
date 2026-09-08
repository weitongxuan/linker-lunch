import { schedule } from 'node-cron';
import { fetchAndStoreMarket } from './market.js';

/** 每個交易日收盤後(台北時間 13:45)自動抓一次行情,取代原本手動跑 market.py。 */
export function startMarketCron() {
  schedule(
    '0 45 13 * * 1-5',
    () => {
      fetchAndStoreMarket().catch((err) => {
        console.error('[market-cron] fetch failed:', err instanceof Error ? err.message : err);
      });
    },
    { timezone: 'Asia/Taipei' },
  );
}
