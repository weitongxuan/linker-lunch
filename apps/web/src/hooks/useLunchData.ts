import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getConfig, getDesserts, getDrinks, getMarket, getParkings, getShops } from '../api/staticData.js';
import { getEatenBulk, getMenusBulk, getRatingsBulk, getReportsBulk, getTempClosedBulk, getVotesBulk } from '../api/places.js';
import { getMe } from '../lib/identity.js';

/** 一次載入全部靜態資料 + 三種 place type 各自的批次共用資料(評分/投票/臨時公休/回報/菜單)。 */
export function useLunchData() {
  const me = getMe();

  const config = useQuery({ queryKey: ['config'], queryFn: getConfig, staleTime: Infinity });
  const shops = useQuery({ queryKey: ['shops'], queryFn: getShops, staleTime: Infinity });
  const drinks = useQuery({ queryKey: ['drinks'], queryFn: getDrinks, staleTime: Infinity });
  const desserts = useQuery({ queryKey: ['desserts'], queryFn: getDesserts, staleTime: Infinity });
  const parkings = useQuery({ queryKey: ['parkings'], queryFn: getParkings, staleTime: Infinity });
  const market = useQuery({ queryKey: ['market'], queryFn: getMarket, staleTime: 5 * 60_000 });

  const shopRatings = useQuery({ queryKey: ['ratings', 'shop'], queryFn: () => getRatingsBulk('shop') });
  const drinkRatings = useQuery({ queryKey: ['ratings', 'drink'], queryFn: () => getRatingsBulk('drink') });
  const dessertRatings = useQuery({ queryKey: ['ratings', 'dessert'], queryFn: () => getRatingsBulk('dessert') });

  const votes = useQuery({ queryKey: ['votes', 'shop'], queryFn: () => getVotesBulk('shop') });
  const tempClosed = useQuery({ queryKey: ['tempClosed', 'shop'], queryFn: () => getTempClosedBulk('shop') });
  const eaten = useQuery({
    queryKey: ['eaten', 'shop', me],
    queryFn: () => getEatenBulk('shop', me),
    enabled: !!me,
  });
  const reports = useQuery({ queryKey: ['reports', 'shop'], queryFn: () => getReportsBulk('shop') });
  const menus = useQuery({ queryKey: ['menus', 'shop'], queryFn: () => getMenusBulk('shop') });

  const isLoading = config.isLoading || shops.isLoading || drinks.isLoading || desserts.isLoading || parkings.isLoading;

  return {
    isLoading,
    config: config.data,
    shops: shops.data ?? [],
    drinks: drinks.data ?? [],
    desserts: desserts.data ?? [],
    parkings: parkings.data ?? [],
    market: market.data ?? null,
    shopRatings: shopRatings.data ?? {},
    drinkRatings: drinkRatings.data ?? {},
    dessertRatings: dessertRatings.data ?? {},
    votes: votes.data ?? {},
    tempClosed: new Set(tempClosed.data ?? []),
    eaten: eaten.data ?? {},
    reports: reports.data ?? {},
    menus: menus.data ?? {},
  };
}

/** 送出一筆評分/回報/投票等變更後,呼叫這個 hook 拿到的 invalidate 函式群組,讓批次資料重新抓一次。 */
export function useLunchDataInvalidation() {
  const qc = useQueryClient();
  return {
    invalidateRatings: (placeType: string) => qc.invalidateQueries({ queryKey: ['ratings', placeType] }),
    invalidateVotes: (placeType: string) => qc.invalidateQueries({ queryKey: ['votes', placeType] }),
    invalidateTempClosed: (placeType: string) => qc.invalidateQueries({ queryKey: ['tempClosed', placeType] }),
    invalidateEaten: (placeType: string) => qc.invalidateQueries({ queryKey: ['eaten', placeType] }),
    invalidateReports: (placeType: string) => qc.invalidateQueries({ queryKey: ['reports', placeType] }),
    invalidateMenus: (placeType: string) => qc.invalidateQueries({ queryKey: ['menus', placeType] }),
  };
}
