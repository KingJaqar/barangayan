'use client';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { isPointInPolygon, type LatLng } from '@barangayan/shared';
import type { Polygon, MultiPolygon } from 'geojson';
import { Button } from '@/components/ui/button';
const Map = dynamic(() => import('@/app/(resident)/settings/location-verification/location-verification-map').then(module => module.LocationVerificationMap), { ssr: false, loading: () => <p>Loading map…</p> });
export function RegistrationMap({ boundary, onConfirm }: { boundary: Polygon | MultiPolygon | null; onConfirm: (value: { gps: LatLng | null; home: LatLng | null }) => void }) {
  const [gps, setGps] = useState<LatLng | null>(null);
  const [home, setHome] = useState<LatLng | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [attempt, setAttempt] = useState(0);
  function move(point: LatLng) { setHome(point); setConfirmed(false); onConfirm({ gps, home: null }); }
  function detect() {
    if (!navigator.geolocation) { setError('Location unavailable. Place a home pin manually or continue without a check.'); return; }
    setLocating(true); setError(null);
    navigator.geolocation.getCurrentPosition(position => {
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setGps(point); onConfirm({ gps: point, home: confirmed ? home : null }); setLocating(false);
    }, cause => { setError(cause.code === 1 ? 'Location permission denied. You can retry or place a home pin manually.' : 'GPS timed out or is unavailable. Retry or place a home pin manually.'); setLocating(false); }, { timeout: 10000, maximumAge: 0 });
  }
  return <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Location check (optional)</h2><p className="text-sm">Red outline: Ampid 1 boundary trace; light fill: covered area. This trace awaits barangay certification. GPS records your device, while the draggable pin records your home.</p>
    <div className="h-80 overflow-hidden rounded border"><Map key={attempt} boundary={boundary} advisory gps={gps} position={home} onPositionChange={move} onRejected={() => {}} onMapError={() => setError('Map network failure. Check your connection and use Retry map. You can still register.')} /></div>
    <p role="status">{!boundary ? 'Unable to check: boundary unavailable. Registration can continue.' : !home ? 'Tap the map to select your home.' : isPointInPolygon(home, boundary) ? 'Home pin is inside Ampid 1.' : 'Home pin is outside Ampid 1. You can still register; staff may review it.'} {confirmed ? 'Location confirmed.' : ''}</p>
    {gps && <p className="text-sm">GPS observation: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>}
    {error && <p role="alert">{error}</p>}
    <p className="text-xs">If tiles fail to load, check your connection and retry the map. An unavailable map does not prevent registration.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" loading={locating} onClick={detect}>Detect My Location</Button><Button type="button" variant="secondary" onClick={() => { setError(null); setAttempt(value => value + 1); }}>Retry map</Button><Button type="button" disabled={!home} onClick={() => { setConfirmed(true); onConfirm({ gps, home }); }}>Confirm Location</Button></div>
  </section>;
}
