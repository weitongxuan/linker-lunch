type Place = { name: string; addr?: string; lat: number; lng: number };

/** 有地址就用「店名 地址」查,查得比純座標準;沒地址就退回座標 */
function placeQuery(place: Place): string {
  return place.addr ? `${place.name} ${place.addr}` : `${place.lat},${place.lng}`;
}

/** 開 Google 地圖搜尋這個地點 */
export function googleMapsUrl(place: Place): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeQuery(place))}`;
}

/** 直接開 Google 地圖導航;手機上有裝 App 會跳進 App 開始導航 */
export function googleDirectionsUrl(place: Place, by: 'walk' | 'drive' | null): string {
  const mode = by === 'drive' ? 'driving' : 'walking';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(placeQuery(place))}&travelmode=${mode}`;
}
