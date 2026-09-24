/** 開 Google Map 搜尋這個地點。有地址就用「店名 地址」查,查得比純座標準;沒地址就退回座標。 */
export function googleMapsUrl(place: { name: string; addr?: string; lat: number; lng: number }): string {
  const query = place.addr ? `${place.name} ${place.addr}` : `${place.lat},${place.lng}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
