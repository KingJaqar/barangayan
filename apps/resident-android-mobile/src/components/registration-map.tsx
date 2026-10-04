import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import * as Location from 'expo-location';
import { isPointInPolygon, type LatLng } from '@barangayan/shared';
import type { Polygon, MultiPolygon } from 'geojson';
import { MapView } from './map-view';
import { PrimaryButton } from './primary-button';
import { ThemedText } from './themed-text';
export function RegistrationMap({ boundary, onConfirm }: { boundary: Polygon | MultiPolygon | null; onConfirm: (value: { gps: LatLng | null; home: LatLng | null }) => void }) {
  const [gps, setGps] = useState<LatLng | null>(null);
  const [home, setHome] = useState<LatLng | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [fit, setFit] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const ready = useRef(false);
  useEffect(() => {
    ready.current = false;
    const timer = setTimeout(() => { if (!ready.current) setError('Map network failure. Check your connection and retry the map. Registration can continue.'); }, 10000);
    return () => clearTimeout(timer);
  }, [attempt]);
  async function detect() {
    setLocating(true); setError(null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error('Location permission denied. Retry or place a home pin manually.');
      const position = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('GPS timed out. Retry or place a home pin manually.')), 10000); })]);
      const point = { lat: position.coords.latitude, lng: position.coords.longitude };
      setGps(point); onConfirm({ gps: point, home: confirmed ? home : null });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Location unavailable. You can still register.'); }
    finally { if (timer) clearTimeout(timer); setLocating(false); }
  }
  return <View style={{ gap: 12 }}><ThemedText type="smallBold">Location check (optional)</ThemedText><ThemedText>Red outline and light fill: Ampid 1 boundary trace, awaiting barangay certification. GPS and your home pin are recorded separately.</ThemedText>
    <MapView key={attempt} markers={gps ? [{ id: 'gps', position: gps, kind: 'gps', label: 'GPS observation' }] : []} boundary={boundary} boundaryRefitKey={fit} constrainPicker={false} picker={{ enabled: true, position: home }} onMapReady={() => { ready.current = true; }} onMapError={() => setError('Map network failure. Check your connection and retry the map. Registration can continue.')} onPickerMoved={point => { setHome(point); setConfirmed(false); onConfirm({ gps, home: null }); }} style={{ height: 320 }} />
    <ThemedText accessibilityLiveRegion="polite">{!boundary ? 'Unable to check: boundary unavailable. Registration can continue.' : !home ? 'Tap the map to select your home.' : isPointInPolygon(home, boundary) ? 'Home pin is inside Ampid 1.' : 'Home pin is outside Ampid 1. You can still register; staff may review it.'} {confirmed ? 'Location confirmed.' : ''}</ThemedText>
    {error && <ThemedText themeColor="accentRed">{error}</ThemedText>}
    <ThemedText type="small">If the map fails to load, check your connection and retry. Registration can continue without a location check.</ThemedText>
    <PrimaryButton label="Detect My Location" loading={locating} onPress={detect} variant="secondary" /><PrimaryButton label="Fit Boundary" disabled={!boundary} onPress={() => setFit(value => value + 1)} variant="secondary" /><PrimaryButton label="Retry map" onPress={() => setAttempt(value => value + 1)} variant="secondary" /><PrimaryButton label="Confirm Location" disabled={!home} onPress={() => { setConfirmed(true); onConfirm({ gps, home }); }} />
  </View>;
}
