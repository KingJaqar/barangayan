'use client';

import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { Maximize2 } from 'lucide-react';

interface BoundaryFitButtonProps {
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  markers: { position: { lat: number; lng: number } }[];
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
}

export function BoundaryFitButton({ boundary, markers, defaultCenter, defaultZoom }: BoundaryFitButtonProps) {
  const map = useMap();

  function handleClick() {
    if (boundary) {
      const layer = L.geoJSON(boundary);
      map.fitBounds(layer.getBounds().pad(0.1));
    } else if (markers.length > 0) {
      const latLngs = markers.map((m) => [m.position.lat, m.position.lng] as [number, number]);
      map.fitBounds(latLngs, { padding: [50, 50] });
    } else {
      map.setView([defaultCenter.lat, defaultCenter.lng], defaultZoom);
    }
  }

  return (
    <button
      onClick={handleClick}
      className="absolute bottom-6 right-4 z-[1000] flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-white/95 shadow-lg shadow-black/5 backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-xl dark:border-white/10 dark:bg-zinc-900/95 dark:hover:border-slate-600 md:right-4"
      title="Reset view"
      aria-label="Reset map view">
      <Maximize2 className="h-4 w-4 text-slate-700 dark:text-slate-300" strokeWidth={2} />
    </button>
  );
}
