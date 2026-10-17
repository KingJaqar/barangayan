'use client';

import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { ScanLine } from 'lucide-react';
import styles from './incident-map.module.css';

interface BoundaryFitButtonProps {
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  markers: { position: { lat: number; lng: number } }[];
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
  boundaryLabel?: string;
}

export function BoundaryFitButton({ boundary, markers, defaultCenter, defaultZoom, boundaryLabel = 'Show whole barangay boundary' }: BoundaryFitButtonProps) {
  const map = useMap();

  function handleClick() {
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = map.getContainer();
    const controls = canvas.parentElement?.querySelector<HTMLElement>('[data-map-controls]');
    const height = map.getSize().y;
    const top = controls ? controls.getBoundingClientRect().bottom - canvas.getBoundingClientRect().top + 24 : 24;
    const padding = {
      paddingTopLeft: L.point(24, Math.min(top, height * 0.5)),
      paddingBottomRight: L.point(Math.min(80, map.getSize().x * 0.2), 80),
      animate,
    };
    map.closePopup();
    if (boundary) {
      const layer = L.geoJSON(boundary);
      map.fitBounds(layer.getBounds().pad(0.05), padding);
    } else if (markers.length > 0) {
      const latLngs = markers.map((m) => [m.position.lat, m.position.lng] as [number, number]);
      map.fitBounds(latLngs, padding);
    } else {
      map.setView([defaultCenter.lat, defaultCenter.lng], defaultZoom, { animate });
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={styles.reset}
      title={boundary ? boundaryLabel : 'Recenter map'}
      aria-label={boundary ? boundaryLabel : 'Recenter map'}>
      <ScanLine size={18} aria-hidden="true" />
    </button>
  );
}
