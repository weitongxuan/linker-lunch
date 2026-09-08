import { prisma } from './prisma.js';

const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart/%5ETWII';

/**
 * 抓台股加權指數(^TWII)最新收盤與漲跌幅,取代原本 market.py 離線腳本。
 * 伺服器端呼叫沒有瀏覽器 CORS 的問題,所以不用再靠離線腳本產生 market.js 內嵌資料。
 */
export async function fetchAndStoreMarket() {
  const res = await fetch(YAHOO_CHART_URL);
  if (!res.ok) throw new Error(`Yahoo Finance 回應 ${res.status}`);
  const json = (await res.json()) as {
    chart: { result: [{ meta: { regularMarketPrice: number; previousClose?: number; chartPreviousClose?: number; regularMarketTime: number } }] };
  };
  const meta = json.chart.result[0].meta;
  const prevClose = meta.previousClose ?? meta.chartPreviousClose ?? meta.regularMarketPrice;
  const close = meta.regularMarketPrice;
  const pct = prevClose ? ((close - prevClose) / prevClose) * 100 : 0;
  const date = new Date(meta.regularMarketTime * 1000).toISOString().slice(0, 10);

  return prisma.market.create({
    data: { date, indexName: '加權指數', close, pct, src: 'Yahoo Finance ^TWII' },
  });
}
