import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { haversine } from '@lunch-map/shared';
import type { AfterPlace, Config, Parking } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';
import { useFilters } from '../state/FiltersContext.js';

const CMAP: Record<string, string> = {
  ok: '--ok', tight: '--tight', unknown: '--nobar', not_enough: '--tight',
  not_lunch: '--no', closed: '--closed', no_time: '--no', out_of_range: '--no',
};

/** 選定一間餐廳後,只保留離它最近的這麼多個停車場/飲料店。 */
const NEAR_LIMIT = 5;
const FOCUS_ZOOM = 17;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#64748b';
}

function nearestFirst<T extends { lat: number; lng: number }>(origin: { lat: number; lng: number }, items: T[]): T[] {
  return [...items].sort((a, b) => haversine(origin, a) - haversine(origin, b));
}

interface AfterRow {
  d: AfterPlace;
  lat: number;
  lng: number;
  openCode: string;
  kind: 'drink' | 'dessert';
}

interface Props {
  config: Config;
  parkings: Parking[];
  rows: Row[];
  afterRows: AfterRow[];
  selectedShopId: string | null;
  onSelectShop: (shopId: string | null) => void;
}

export function MapPane({ config, parkings, rows, afterRows, selectedShopId, onSelectShop }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const parkLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Record<string, L.CircleMarker>>({});
  const { state } = useFilters();

  const selectedRow = selectedShopId ? rows.find((r) => r.sh.id === selectedShopId) ?? null : null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([config.office.lat, config.office.lng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);
    L.marker([config.office.lat, config.office.lng]).addTo(map).bindPopup(`<b>${config.office.name}</b>`);

    const walkRadius = (5 * config.walkSpeed) / config.detour;
    const walk10Radius = (config.maxWalkMin * config.walkSpeed) / config.detour;
    L.circle([config.office.lat, config.office.lng], { radius: walkRadius, color: cssVar('--dim'), dashArray: '4 4', fill: false }).addTo(map);
    L.circle([config.office.lat, config.office.lng], { radius: walk10Radius, color: cssVar('--dim'), dashArray: '4 4', fill: false }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    parkLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [config]);

  // 點空白地圖區域 = 取消選取,恢復顯示全部餐廳。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handleClick = () => onSelectShop(null);
    map.on('click', handleClick);
    return () => {
      map.off('click', handleClick);
    };
  }, [onSelectShop]);

  // 選定餐廳時,地圖 focus 過去;取消選取時回到原本的總覽視角。
  // 手機版在「僅列表」畫面時 #mapwrap 是 display:none(容器尺寸為 0),
  // 這時呼叫 flyTo 會讓 Leaflet 的動畫運算(除以容器尺寸)壞掉、把整頁卡死變空白,
  // 所以容器不可見時改用沒有動畫的 setView。
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const size = map.getSize();
    const canAnimate = size.x > 0 && size.y > 0;
    const target: [number, number] = selectedRow
      ? [selectedRow.sh.lat, selectedRow.sh.lng]
      : [config.office.lat, config.office.lng];
    const zoom = selectedRow ? FOCUS_ZOOM : 15;
    if (canAnimate) {
      map.flyTo(target, zoom, { duration: 0.5 });
    } else {
      map.setView(target, zoom, { animate: false });
    }
  }, [selectedRow, config]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current = {};

    // 選定餐廳後只畫這一間,其餘餐廳隱藏。
    const shopsToShow = selectedRow ? [selectedRow] : rows;
    for (const r of shopsToShow) {
      const color = cssVar(CMAP[r.f.code] ?? '--no');
      const marker = L.circleMarker([r.sh.lat, r.sh.lng], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2,
        bubblingMouseEvents: false,
      });
      const scoreTxt = r.sc.n ? `★ ${r.sc.avg.toFixed(1)} (${r.sc.n} 人)` : '尚無評分';
      marker.bindPopup(
        `<b>${r.sh.name}</b><br>${r.f.label} · ${r.sh.category.join('、')}<br>${scoreTxt}<br><span style="color:var(--dim)">${r.f.why ?? ''}</span>`,
      );
      marker.on('click', () => onSelectShop(r.sh.id));
      marker.addTo(layer);
      markersRef.current[r.sh.id] = marker;
    }

    // 選定餐廳後,飲料店只保留離它最近的幾間(甜點不算,依需求只留飲料店)。
    const afterRowsToShow = selectedRow
      ? nearestFirst(selectedRow.sh, afterRows.filter((a) => a.kind === 'drink')).slice(0, NEAR_LIMIT)
      : afterRows;

    for (const a of afterRowsToShow) {
      const isDrink = a.kind === 'drink';
      const fillColor = isDrink
        ? cssVar('--map-drink')
        : a.openCode === 'open'
          ? cssVar('--ok')
          : a.openCode === 'later'
            ? cssVar('--tight')
            : cssVar('--no');
      const color = isDrink ? '#000000' : fillColor;
      L.circleMarker([a.lat, a.lng], { radius: 5, color, fillColor, fillOpacity: 0.8, weight: isDrink ? 1.5 : 1, bubblingMouseEvents: false })
        .bindPopup(`<b>${a.d.name}</b><br>${a.d.kind}`)
        .addTo(layer);
    }
  }, [rows, afterRows, selectedRow, onSelectShop]);

  // 選定餐廳時,沿實際道路從辦公室畫一條路徑導航過去。
  useEffect(() => {
    const map = mapRef.current;
    const routeLayer = routeLayerRef.current;
    if (!map || !routeLayer) return;
    routeLayer.clearLayers();
    if (!selectedRow) return;

    const controller = new AbortController();
    const profile = selectedRow.by === 'drive' ? 'driving' : 'foot';
    const from = `${config.office.lng},${config.office.lat}`;
    const to = `${selectedRow.sh.lng},${selectedRow.sh.lat}`;
    const url = `https://router.project-osrm.org/route/v1/${profile}/${from};${to}?overview=full&geometries=geojson`;

    fetch(url, { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => {
        const coords = data?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
        if (!coords || coords.length === 0) return;
        const latlngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);
        const line = L.polyline(latlngs, { color: cssVar('--accent'), weight: 4, opacity: 0.85 }).addTo(routeLayer);
        map.fitBounds(line.getBounds(), { padding: [40, 40] });
      })
      .catch((err) => {
        if (err.name !== 'AbortError') console.error('route fetch failed', err);
      });

    return () => controller.abort();
  }, [selectedRow, config]);

  useEffect(() => {
    const parkLayer = parkLayerRef.current;
    if (!parkLayer) return;
    parkLayer.clearLayers();

    // 選定餐廳後,停車場只保留離它最近的幾個。
    const parkingsToShow = selectedRow ? nearestFirst(selectedRow.sh, parkings).slice(0, NEAR_LIMIT) : parkings;
    const parkColor = cssVar('--park');
    for (const p of parkingsToShow) {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: parkColor, fillColor: parkColor, fillOpacity: 0.5, weight: 1, bubblingMouseEvents: false })
        .bindPopup(`<b>${p.name}</b><br>${p.kind}${p.spaces ? ` · ${p.spaces} 位` : ''}`)
        .addTo(parkLayer);
    }
  }, [parkings, selectedRow]);

  useEffect(() => {
    if (!selectedShopId) return;
    const marker = markersRef.current[selectedShopId];
    if (marker) marker.openPopup();
  }, [selectedShopId]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = setTimeout(() => map.invalidateSize(), 80);
    return () => clearTimeout(id);
  }, [state.view]);

  return (
    <div id="mapwrap">
      <div id="map" ref={containerRef} />
      {selectedRow && (
        <button type="button" className="btn map-clear-btn" onClick={() => onSelectShop(null)}>
          顯示全部餐廳
        </button>
      )}
    </div>
  );
}
