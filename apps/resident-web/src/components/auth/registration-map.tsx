'use client';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { beginAttempt, notify, type OperationId } from '@/lib/notify';
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
  const [attempt, setAttempt] = useState<{ key: number; notification: OperationId | null }>({ key: 0, notification: null });
  const [announceError, setAnnounceError] = useState(true);
  const mounted = useRef(false);
  const detecting = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function move(point: LatLng) { setHome(point); setConfirmed(false); onConfirm({ gps, home: null }); }
  function detect() {
    if (detecting.current) return;
    const notification = beginAttempt('registration-location');
    setAnnounceError(false);
    if (!navigator.geolocation) { setError('Location unavailable. Place a home pin manually or continue without a check.'); notify.error("Couldn't find your location. Try again or place your home pin manually.", { id: notification }); return; }
    detecting.current = true;
    setLocating(true); setError(null);
    navigator.geolocation.getCurrentPosition(position => {
      detecting.current = false;
      if (!mounted.current) return;
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setGps(point); onConfirm({ gps: point, home: confirmed ? home : null }); setLocating(false);
      notify.success('Device location found.', { id: notification });
    }, cause => { detecting.current = false; if (!mounted.current) return; setError(cause.code === 1 ? 'Location permission denied. You can retry or place a home pin manually.' : 'GPS timed out or is unavailable. Retry or place a home pin manually.'); setLocating(false); notify.error(cause.code === 1 ? 'Location access is blocked. Allow access or place your home pin manually.' : "Couldn't find your location. Try again or place your home pin manually.", { id: notification }); }, { timeout: 10000, maximumAge: 0 });
  }
  return <section className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Location check (optional)</h2><p className="text-sm">Red outline: Ampid 1 boundary trace; light fill: covered area. This trace awaits barangay certification. GPS records your device, while the draggable pin records your home.</p>
    <div className="h-80 overflow-hidden rounded border"><Map key={attempt.key} boundary={boundary} advisory gps={gps} position={home} onPositionChange={move} onRejected={() => {}} onMapError={() => { setAnnounceError(attempt.notification === null); setError('Map network failure. Check your connection and use Retry map. You can still register.'); if (attempt.notification) notify.error("Couldn't load the map. You can still continue registration.", { id: attempt.notification }); }} /></div>
    <p role={confirmed ? undefined : 'status'}>{!boundary ? 'Unable to check: boundary unavailable. Registration can continue.' : !home ? 'Tap the map to select your home.' : isPointInPolygon(home, boundary) ? 'Home pin is inside Ampid 1.' : 'Home pin is outside Ampid 1. You can still register; staff may review it.'} {confirmed ? 'Location confirmed.' : ''}</p>
    {gps && <p className="text-sm">GPS observation: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>}
    {error && <p role={announceError ? 'alert' : undefined}>{error}</p>}
    <p className="text-xs">If tiles fail to load, check your connection and retry the map. An unavailable map does not prevent registration.</p>
    <div className="flex flex-wrap gap-2"><Button type="button" variant="secondary" loading={locating} onClick={detect}>Detect My Location</Button><Button type="button" variant="secondary" onClick={() => { const notification = beginAttempt('registration-map'); setError(null); setAttempt(value => ({ key: value.key + 1, notification })); }}>Retry map</Button><Button type="button" disabled={!home} onClick={() => { if (!home) return; setConfirmed(true); onConfirm({ gps, home }); notify.success('Home location selected for registration.', { id: beginAttempt('registration-home') }); }}>Confirm Location</Button></div>
  </section>;
}
