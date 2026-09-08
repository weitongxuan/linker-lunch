import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { AfterPlace, Config, Parking } from '@lunch-map/shared';
import type { Row } from '../hooks/useComputedRows.js';
import { useFilters } from '../state/FiltersContext.js';

const CMAP: Record<string, string> = {
  ok: '--ok', tight: '--tight', unknown: '--nobar', not_enough: '--tight',
  not_lunch: '--no', closed: '--closed', temp: '--closed', no_time: '--no', out_of_range: '--no',
};

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#64748b';
}

interface AfterRow {
  d: AfterPlace;
  lat: number;
  lng: number;
  openCode: string;
}

interface Props {
  config: Config;
  parkings: Parking[];
  rows: Row[];
  afterRows: AfterRow[];
  selectedShopId: string | null;
  onSelectShop: (shopId: string) => void;
}

export function MapPane({ config, parkings, rows, afterRows, selectedShopId, onSelectShop }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const parkLayerRef = useRef<L.LayerGroup | null>(null);
  const markersRef = useRef<Record<string, L.CircleMarker>>({});
  const { state } = useFilters();

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
    L.circle([config.office.lat, config.office.lng], { radius: walkRadius, color: '#94a3b8', dashArray: '4 4', fill: false }).addTo(map);
    L.circle([config.office.lat, config.office.lng], { radius: walk10Radius, color: '#94a3b8', dashArray: '4 4', fill: false }).addTo(map);

    layerRef.current = L.layerGroup().addTo(map);
    parkLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [config]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    markersRef.current = {};

    for (const r of rows) {
      const color = cssVar(CMAP[r.f.code] ?? '--no');
      const marker = L.circleMarker([r.sh.lat, r.sh.lng], {
        radius: 7,
        color,
        fillColor: color,
        fillOpacity: 0.85,
        weight: 2,
      });
      const scoreTxt = r.sc.n ? `★ ${r.sc.avg.toFixed(1)} (${r.sc.n} 人)` : '尚無評分';
      marker.bindPopup(
        `<b>${r.sh.name}</b><br>${r.f.label} · ${r.sh.category}<br>${scoreTxt}<br><span style="color:var(--dim)">${r.f.why ?? ''}</span>`,
      );
      marker.on('click', () => onSelectShop(r.sh.id));
      marker.addTo(layer);
      markersRef.current[r.sh.id] = marker;
    }

    for (const a of afterRows) {
      const color = a.openCode === 'open' ? cssVar('--ok') : a.openCode === 'later' ? cssVar('--tight') : cssVar('--no');
      L.circleMarker([a.lat, a.lng], { radius: 5, color, fillColor: color, fillOpacity: 0.8, weight: 1 })
        .bindPopup(`<b>${a.d.name}</b><br>${a.d.kind}`)
        .addTo(layer);
    }
  }, [rows, afterRows, onSelectShop]);

  useEffect(() => {
    const parkLayer = parkLayerRef.current;
    if (!parkLayer) return;
    parkLayer.clearLayers();
    for (const p of parkings) {
      L.circleMarker([p.lat, p.lng], { radius: 5, color: '#65319f', fillColor: '#65319f', fillOpacity: 0.5, weight: 1 })
        .bindPopup(`<b>${p.name}</b><br>${p.kind}${p.spaces ? ` · ${p.spaces} 位` : ''}`)
        .addTo(parkLayer);
    }
  }, [parkings]);

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
    </div>
  );
}
