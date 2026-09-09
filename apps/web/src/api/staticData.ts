import type { AfterPlace, Config, Market, Parking, Shop } from '@lunch-map/shared';
import { apiGet, apiPost } from './client.js';
import type { OsmImportSummary } from './types.js';

export const getConfig = () => apiGet<Config>('/api/config');
export const getShops = () => apiGet<Shop[]>('/api/shops');
export const getDrinks = () => apiGet<AfterPlace[]>('/api/drinks');
export const getDesserts = () => apiGet<AfterPlace[]>('/api/desserts');
export const getParkings = () => apiGet<Parking[]>('/api/parkings');
export const getMarket = () => apiGet<Market>('/api/market').catch(() => null);

export const refreshMarket = () => apiPost<Market>('/api/market/refresh');
export const importOsmShops = () => apiPost<OsmImportSummary>('/api/shops/import/osm');
export const importOsmParkings = () => apiPost<OsmImportSummary>('/api/parkings/import/osm');
export const addShop = (shop: Omit<Shop, 'id' | 'needsReview'>) => apiPost<Shop>('/api/shops', shop);
export const addDrink = (place: Omit<AfterPlace, 'id'>) => apiPost<AfterPlace>('/api/drinks', place);
