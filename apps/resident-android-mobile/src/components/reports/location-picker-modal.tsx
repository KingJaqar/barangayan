import { Ionicons } from '@expo/vector-icons';
import { isPointInPolygon, reverseGeocode, type LatLng } from '@barangayan/shared';
import * as Location from 'expo-location';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ActivityIndicator, KeyboardAvoidingView, Modal, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapView, type MapViewHandle } from '@/components/map-view';
import { isMapPosition } from '@/lib/map-presentation';
import { ReportMapControls } from '@/components/reports/report-map-controls';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { PrimaryButton } from '@/components/primary-button';
import { ReportSourceState } from '@/components/reports/report-presentation';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useTheme } from '@/hooks/use-theme';

export interface LocationPickerResult { position: LatLng; address: string | null }
interface LocationPickerModalProps {
  visible: boolean; initialPosition: LatLng | null; initialAddress?: string | null;
  boundary: Polygon | MultiPolygon | null; barangayName?: string | null;
  onCancel: () => void; onConfirm: (result: LocationPickerResult) => void;
}
export function LocationPickerModal(props: LocationPickerModalProps) {
  const { mounted, panel, reduced } = useReportModalMotion(props.visible);
  const { height } = useWindowDimensions();
  return <Modal visible={mounted} animationType="none" statusBarTranslucent onRequestClose={props.onCancel}>
    <Animated.View style={{ flex: 1, opacity: reduced ? panel : 1, transform: [{ translateY: reduced ? 0 : panel.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }}>
      {mounted ? <PickerContent {...props} /> : null}
    </Animated.View>
  </Modal>;
}
function PickerContent({ visible, initialPosition, initialAddress, boundary, barangayName, onCancel, onConfirm }: LocationPickerModalProps) {
  const { resident } = useTheme();
  const { fontId } = useFontPreference();
  const reducedMotion = useResidentReducedMotion(true);
  const map = useRef<MapViewHandle>(null);
  const [initialFocus] = useState(() => isMapPosition(initialPosition) ? { ...initialPosition, zoom: 17 } : undefined);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const locationOwner = useRef(0);
  const locationBusy = useRef(false);
  const locationTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const colors = useMemo(() => ({ picker: resident.accent }), [resident.accent]);
  const presentation = useMemo(() => ({ selectedMarkerId: null, padding: { top: 44, bottom: 88 }, attributionBottom: 0,
    reducedMotion, surface: resident.card, text: resident.text, border: resident.border, fontFamily: getMobileFontFamily(fontId) ?? 'sans-serif',
  }), [reducedMotion, resident.card, resident.text, resident.border, fontId]);
  useEffect(() => () => { locationOwner.current++; if (locationTimeout.current) clearTimeout(locationTimeout.current); }, []);
  async function locate() {
    if (locationBusy.current) return;
    locationBusy.current = true; setLocating(true); setLocationError(null);
    const owner = ++locationOwner.current;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (owner !== locationOwner.current) return;
      if (permission.status !== 'granted') throw new Error('Allow location access to use your current position. You can still place the pin manually.');
      const fix = await Promise.race([Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), new Promise<never>((_, reject) => {
        locationTimeout.current = setTimeout(() => reject(new Error('Location timed out. Try again or place the pin manually.')), 10000);
      })]);
      if (owner !== locationOwner.current) return;
      const point = { lat: fix.coords.latitude, lng: fix.coords.longitude };
      if (boundary && !isPointInPolygon(point, boundary)) { setRejected(true); return; }
      setPosition(point); setAddress(''); setGeocodeTarget(point); setRejected(false); map.current?.flyTo({ ...point, zoom: 17 });
    } catch (error) { if (owner === locationOwner.current) setLocationError(error instanceof Error ? error.message : 'Unable to get your location. Place the pin manually.'); }
    finally { if (locationTimeout.current) { clearTimeout(locationTimeout.current); locationTimeout.current = undefined; } if (owner === locationOwner.current) { locationBusy.current = false; setLocating(false); } }
  }
  const [position, setPosition] = useState(initialPosition);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [geocodeTarget, setGeocodeTarget] = useState(initialAddress ? null : initialPosition);
  const [loading, setLoading] = useState(false);
  const [geocodeFailed, setGeocodeFailed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [mapFailed, setMapFailed] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  const request = useRef(0);
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      setPosition(initialPosition); setAddress(initialAddress ?? ''); setRejected(false); setMapFailed(false);
      setGeocodeTarget(initialAddress ? null : initialPosition);
    }
    wasVisible.current = visible;
  }, [visible, initialPosition, initialAddress]);
  useEffect(() => {
    const ticket = ++request.current;
    if (!visible || !geocodeTarget) { setLoading(false); return; }
    let active = true;
    setLoading(true); setGeocodeFailed(false);
    void reverseGeocode(geocodeTarget).then(result => {
      if (!active || request.current !== ticket) return;
      setLoading(false);
      if (result) setAddress(result); else setGeocodeFailed(true);
    }).catch(() => { if (active && request.current === ticket) { setLoading(false); setGeocodeFailed(true); } });
    return () => { active = false; };
  }, [geocodeTarget, visible]);
  return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: resident.card }}>
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      <ServiceScreenHeader title="Pin Your Location" onBack={onCancel} backLabel="Cancel" backIcon="close" />
      <View style={styles.map}>
        <MapView key={mapAttempt} ref={map} markers={[]} focusPosition={initialFocus} boundary={boundary} kindColors={colors} presentation={presentation} picker={{ enabled: visible, position }}
          onPickerMoved={next => { setAddress(''); setPosition(next); setGeocodeTarget(next); setRejected(false); }}
          onPickerRejected={() => setRejected(true)} onMapError={() => setMapFailed(true)} style={StyleSheet.absoluteFill} />
        <View pointerEvents="none" style={[styles.hint, { backgroundColor: resident.mediaScrim }]}><Ionicons name="hand-left-outline" size={16} color={resident.mediaForeground} /><ThemedText style={{ color: resident.mediaForeground, fontSize: 13, fontWeight: '700' }}>Tap or drag the pin</ThemedText></View>
        <ReportMapControls onZoomIn={() => map.current?.zoomIn()} onZoomOut={() => map.current?.zoomOut()} onFit={() => map.current?.fitBoundary()} onLocate={() => { void locate(); }} locating={locating} />
        {mapFailed ? <ReportSourceState message="The map could not be loaded." retry={() => { setMapFailed(false); setMapAttempt(value => value + 1); }} /> : null}
        {rejected ? <View style={[styles.rejected, { backgroundColor: resident.dangerSoft }]}><ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>Please pin a location inside {barangayName ?? 'the barangay'}'s boundary.</ThemedText></View> : null}
      </View>
      <View style={[styles.sheet, { borderTopColor: resident.border }]}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 8 }}>
          {locationError ? <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>{locationError}</ThemedText> : null}
          <View style={styles.label}><ThemedText style={{ fontSize: 15, fontWeight: '700', color: resident.text }}>Address</ThemedText>{loading ? <ActivityIndicator color={resident.accentText} /> : null}</View>
          <TextField presentation="resident" appearance="requestForm" accessibilityLabel="Address, optional"
            value={address} onChangeText={value => { request.current++; setLoading(false); setAddress(value); }}
            placeholder={loading ? 'Detecting address…' : 'Type to correct the detected address'} maxLength={300} />
          {geocodeFailed ? <ThemedText accessibilityRole="alert" style={{ fontSize: 12.5, color: resident.muted }}>The address could not be detected. You can type it or continue with the pinned coordinates.</ThemedText> : null}
          {position ? <ThemedText style={{ color: resident.muted, fontSize: 12.5 }}>{position.lat.toFixed(5)}, {position.lng.toFixed(5)}</ThemedText> : null}
        </ScrollView>
        <PrimaryButton presentation="resident" label="Use This Location" disabled={!position} onPress={() => { if (position) onConfirm({ position, address: address.trim() || null }); }} />
      </View>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  map: { flex: 1, minHeight: 80 },
  hint: { position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', gap: 6, alignItems: 'center', borderRadius: 100, paddingHorizontal: 14, paddingVertical: 10 },
  rejected: { position: 'absolute', bottom: 84, left: 16, right: 16, padding: 12, borderRadius: 12 },
  sheet: { maxHeight: '55%', padding: 20, borderTopWidth: 1, gap: 18 },
  label: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
