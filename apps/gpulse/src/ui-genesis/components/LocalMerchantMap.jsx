import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDistanceKm } from '../local-marketplace/geo.js';

/**
 * @param {{ center: [number, number], zoom: number }} props
 */
function MapViewSync({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom, { animate: true });
  }, [center, zoom, map]);
  return null;
}

function MapResizeFix() {
  const map = useMap();
  useEffect(() => {
    const run = () => map.invalidateSize();
    const t = window.setTimeout(run, 120);
    window.addEventListener('resize', run);
    return () => {
      window.removeEventListener('resize', run);
      window.clearTimeout(t);
    };
  }, [map]);
  return null;
}

/**
 * @param {{
 *   merchants: Array<import('../local-marketplace/mockMerchants.js').LocalMerchant & { distanceKm: number | null }>,
 *   mapCenter: [number, number],
 *   zoom: number,
 *   selectedId: string | null,
 *   onSelect: (id: string) => void,
 * }} props
 */
export function LocalMerchantMap({ merchants, mapCenter, zoom, selectedId, onSelect }) {
  return (
    <div className="local-leaflet-wrap relative h-[340px] w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)] md:h-[min(520px,calc(100vh-14rem))]">
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom
        attributionControl
      >
        <MapResizeFix />
        <MapViewSync center={mapCenter} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {merchants.map((m) => {
          const selected = m.id === selectedId;
          const radius = 7 + m.popularity * 16 + (selected ? 4 : 0);
          const aig = m.acceptsAIG;
          const fill = aig ? '#22d3ee' : '#a78bfa';
          const stroke = selected ? '#f472b6' : aig ? '#06b6d4' : '#7c3aed';
          return (
            <CircleMarker
              key={m.id}
              center={[m.lat, m.lng]}
              radius={radius}
              pathOptions={{
                color: stroke,
                fillColor: fill,
                fillOpacity: selected ? 0.95 : 0.82,
                weight: selected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onSelect(m.id),
              }}
            >
              <Popup>
                <div className="min-w-[200px] font-sans text-slate-900">
                  <p className="font-bold">{m.name}</p>
                  <p className="text-xs text-slate-600">
                    {aig ? 'Accepts AIG' : 'USD / fiat'} · {formatDistanceKm(m.distanceKm)}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs font-semibold text-cyan-700 underline"
                    onClick={() => onSelect(m.id)}
                  >
                    View listing
                  </button>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2 text-[10px] font-semibold">
        <span className="rounded-full bg-slate-950/85 px-2 py-1 text-cyan-300 ring-1 ring-cyan-500/40">● AIG</span>
        <span className="rounded-full bg-slate-950/85 px-2 py-1 text-violet-300 ring-1 ring-violet-500/40">● No AIG</span>
        <span className="rounded-full bg-slate-950/85 px-2 py-1 text-slate-300 ring-1 ring-white/15">Size ∝ popularity</span>
      </div>
    </div>
  );
}
