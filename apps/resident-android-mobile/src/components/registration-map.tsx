import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { isPointInPolygon, reverseGeocode, type LatLng } from '@barangayan/shared';
import type { Polygon, MultiPolygon } from 'geojson';
import { MapView } from './map-view';
import { PrimaryButton } from './primary-button';
import { ThemedText } from './themed-text';
import { useTheme } from '@/hooks/use-theme';

export function RegistrationMap({ boundary, onConfirm }: { boundary: Polygon | MultiPolygon | null; onConfirm: (value: { gps: LatLng | null; home: LatLng | null }) => void }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [gps, setGps] = useState<LatLng | null>(null);
  const [home, setHome] = useState<LatLng | null>(null);
  const [pinAddress, setPinAddress] = useState<{ point: LatLng; address: string | null } | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mapError, setMapError] = useState(false);
  const [locating, setLocating] = useState(false);
  const [fit, setFit] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const ready = useRef(false);
  const addressLoading = home !== null && pinAddress?.point !== home;
  const address = home && pinAddress?.point === home ? pinAddress.address : null;

  useEffect(() => {
    if (!home) return;
    let active = true;
    // Wait for pin movement to settle and discard responses for an older pin.
    const timer = setTimeout(() => {
      void reverseGeocode(home).then(result => {
        if (active) setPinAddress({ point: home, address: result });
      });
    }, 1000);
    return () => { active = false; clearTimeout(timer); };
  }, [home]);

  useEffect(() => {
    if (!expanded) return;
    ready.current = false;
    const timer = setTimeout(() => { if (!ready.current) setMapError(true); }, 10000);
    return () => clearTimeout(timer);
  }, [expanded, attempt]);
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
  return (
    <View style={styles.section}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint="Show or hide the optional location map and controls"
        onPress={() => setExpanded(value => !value)}
        style={styles.disclosure}>
        <View style={styles.summary}>
          <ThemedText type="smallBold">Location check (optional)</ThemedText>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {confirmed ? address ?? 'Home location confirmed.' : gps ? 'GPS recorded. You can also add a home pin.' : 'Add a home pin, or continue without a location check.'}
          </ThemedText>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
      </Pressable>
      {expanded && (
        <View style={styles.section}>
          <ThemedText type="small">Red outline and light fill: Ampid 1 boundary trace, awaiting barangay certification. GPS and your home pin are recorded separately.</ThemedText>
          <MapView
            key={attempt}
            markers={gps ? [{ id: 'gps', position: gps, kind: 'gps', label: 'GPS observation' }] : []}
            boundary={boundary}
            boundaryRefitKey={fit}
            constrainPicker={false}
            picker={{ enabled: true, position: home }}
            onMapReady={() => { ready.current = true; setMapError(false); }}
            onMapError={() => setMapError(true)}
            onPickerMoved={point => { setHome(point); setConfirmed(false); onConfirm({ gps, home: null }); }}
            style={{ height: 320 }}
          />
          <View style={styles.tools}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Detect my location"
              accessibilityState={{ disabled: locating, busy: locating }}
              disabled={locating}
              onPress={detect}
              style={styles.tool}>
              {locating && <ActivityIndicator size="small" color={theme.primary} />}
              <ThemedText type="smallBold" style={{ color: theme.primary }}>{locating ? 'Locating…' : 'Detect my location'}</ThemedText>
            </Pressable>
            {boundary && (
              <Pressable accessibilityRole="button" onPress={() => setFit(value => value + 1)} style={styles.tool}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>Show boundary</ThemedText>
              </Pressable>
            )}
            {mapError && (
              <Pressable accessibilityRole="button" onPress={() => { setMapError(false); setAttempt(value => value + 1); }} style={styles.tool}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>Retry map</ThemedText>
              </Pressable>
            )}
          </View>
          {home && (
            <View style={styles.address}>
              <ThemedText type="smallBold">Pinned address</ThemedText>
              <ThemedText type="small" accessibilityLiveRegion="polite">
                {addressLoading ? 'Looking up address…' : address ?? 'Address unavailable for this pin. You can still register.'}
              </ThemedText>
              {!addressLoading && !address && (
                <ThemedText type="small" themeColor="textSecondary">{home.lat.toFixed(6)}, {home.lng.toFixed(6)}</ThemedText>
              )}
            </View>
          )}
          <ThemedText type="small" accessibilityLiveRegion="polite">{!boundary ? 'Unable to check: boundary unavailable. Registration can continue.' : !home ? 'Tap the map to select your home.' : isPointInPolygon(home, boundary) ? 'Home pin is inside Ampid 1.' : 'Home pin is outside Ampid 1. You can still register; staff may review it.'} {confirmed ? 'Location confirmed.' : ''}</ThemedText>
          {error && <ThemedText type="small" themeColor="accentRed" accessibilityLiveRegion="polite">{error}</ThemedText>}
          {mapError && <ThemedText type="small" themeColor="accentRed" accessibilityLiveRegion="polite">Map unavailable. Check your connection and retry, or continue registration without a location check.</ThemedText>}
          {home && !confirmed && (
            <PrimaryButton label="Confirm home location" variant="secondary" accessibilityRole="button" onPress={() => { setConfirmed(true); onConfirm({ gps, home }); }} />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  disclosure: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 48, paddingVertical: 8 },
  summary: { flex: 1, gap: 4 },
  address: { gap: 4 },
  tools: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16 },
  tool: { minHeight: 44, paddingHorizontal: 4, flexDirection: 'row', alignItems: 'center', gap: 8 },
});
