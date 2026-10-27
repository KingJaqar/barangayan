/**
 * Settings > Location Verification.
 *
 * A full-screen map (centered on the resident's barangay — Ampid I, San Mateo for this
 * pilot — with its boundary outlined) where the resident drags a pin to their exact
 * home location and saves it. Reuses the same MapView + boundary-constrained picker
 * mode already built for Incident Reports' "pin your location" flow
 * (components/reports/location-picker-modal.tsx / components/map-view.tsx) — dragging
 * or tapping outside the boundary is rejected and the pin snaps back. Also reuses that
 * flow's reverse-geocode-then-editable-address pattern (reverseGeocode) so the pin's
 * address shows as readable text, not just coordinates, and the resident can correct it.
 *
 * Persists to profiles.verified_location (jsonb {lat,lng}) + verified_location_address
 * (text, migration 0091) + location_verified_at (migration 0090). This is a
 * resident-initiated, self-reported confirmation — distinct from
 * profiles.registration_location (0078), the one-time best-effort GPS fix captured
 * automatically at signup for admin review.
 */
import { Ionicons } from '@expo/vector-icons';
import type { LatLng } from '@barangayan/shared';
import { reverseGeocode, isPointInPolygon } from '@barangayan/shared';
import * as Location from 'expo-location';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuestPrompt } from '@/components/guest-prompt';
import { AuthHeader } from '@/components/auth-header';
import { AMPID_I_SAN_MATEO_CENTER, MapView } from '@/components/map-view';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useFloatingTabLayout } from '@/hooks/use-floating-tab-layout';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { isMapPosition } from '@/lib/map-presentation';
import { supabase } from '@/lib/supabase';

export default function LocationVerificationScreen() {
  const { session } = useAuth();
  return <LocationVerificationContent key={session?.user.id ?? 'guest'} />;
}

function LocationVerificationContent() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { session } = useAuth();
  const { profile, isLoading, isInitialLoading, error: profileError, refetch } = useProfile();
  const { keyboardVisible } = useFloatingTabLayout();
  const pull = usePullRefresh([refetch]);

  const boundary = (profile?.barangays?.boundary as unknown as Polygon | MultiPolygon | null) ?? null;
  const savedLocation = isMapPosition(profile?.verified_location) ? profile.verified_location : null;
  const savedAddress = profile?.verified_location_address;

  const [position, setPosition] = useState<LatLng | null>(null);
  const [address, setAddress] = useState('');
  const [addressLoading, setAddressLoading] = useState(false);
  // True once a geocode attempt has finished with no result — distinguishes "still
  // detecting" from "detection failed, please type it in" so an empty field after
  // loading doesn't just look broken.
  const [addressDetectFailed, setAddressDetectFailed] = useState(false);
  const [locating, setLocating] = useState(false);
  const [rejectedNotice, setRejectedNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const geocodeRequestId = useRef(0);
  const locationRequestId = useRef(0);
  const active = useRef(true);
  const savingRef = useRef(false);
  const [mapError, setMapError] = useState(false);
  const [mapAttempt, setMapAttempt] = useState(0);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; geocodeRequestId.current += 1; };
  }, []);

  async function fetchAddressFor(pos: LatLng) {
    const requestId = ++geocodeRequestId.current;
    setAddressLoading(true);
    setAddressDetectFailed(false);
    const result = await reverseGeocode(pos);
    // Ignore stale responses from a since-superseded pin placement.
    if (!active.current || requestId !== geocodeRequestId.current) return;
    setAddressLoading(false);
    if (result) setAddress(result);
    else setAddressDetectFailed(true);
  }

  // Seed the pin: the resident's previously-saved location if there is one (with its
  // previously-saved address, so a re-visit doesn't re-geocode for no reason), otherwise
  // try a live GPS fix — auto-detecting its address — falling back to the barangay's
  // default center if that fails (permission denied, GPS unavailable, or an emulator
  // with no fix).
  useEffect(() => {
    if (!profile) return;
    if (savedLocation) {
      setPosition(savedLocation);
      if (savedAddress) setAddress(savedAddress);
      else void fetchAddressFor(savedLocation);
      return;
    }
    let cancelled = false;
    const requestId = ++locationRequestId.current;
    const isCurrent = () => !cancelled && requestId === locationRequestId.current;
    setLocating(true);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!isCurrent()) return;
        if (status !== 'granted') {
          if (isCurrent()) setPosition(AMPID_I_SAN_MATEO_CENTER);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!isCurrent()) return;
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!boundary || !isPointInPolygon(point, boundary)) { if (isCurrent()) setRejectedNotice(true); return; }
        if (isCurrent()) {
          setPosition(point);
          void fetchAddressFor(point);
        }
      } catch {
        if (isCurrent()) setPosition(AMPID_I_SAN_MATEO_CENTER);
      } finally {
        if (isCurrent()) setLocating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  /** "Detect Your Location" button — a manual, explicit re-run of the same GPS fix the
   * screen tries automatically on first load (see the seed effect above), for a resident
   * who wants to re-center on their current device location instead of dragging the pin
   * by hand (e.g. after the pin drifted while adjusting the address, or on a return visit
   * where the previously-saved pin no longer matches where they're standing). Moves the
   * pin and re-detects its address exactly like a drag/tap does. Unlike the silent
   * first-load fallback, a failure here is a direct result of this tap, so it's reported
   * with an alert rather than silently falling back to the barangay's default center.
   */
  async function handleDetectLocation() {
    if (locating || savingRef.current) return;
    const requestId = ++locationRequestId.current;
    const isCurrent = () => active.current && requestId === locationRequestId.current;
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!isCurrent()) return;
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Needed',
          'Allow Barangayan to access your device location in Settings, then try again.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!isCurrent()) return;
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      if (!boundary || !isPointInPolygon(point, boundary)) { setRejectedNotice(true); return; }
      setPosition(point);
      setRejectedNotice(false);
      setSaved(false);
      void fetchAddressFor(point);
    } catch {
      if (isCurrent()) Alert.alert('Location Unavailable', "Couldn't detect your current location. Please try again or drag the pin manually.");
    } finally {
      if (isCurrent()) setLocating(false);
    }
  }

  function handlePickerMoved(pos: LatLng) {
    if (savingRef.current || !isMapPosition(pos)) return;
    locationRequestId.current += 1;
    setLocating(false);
    setPosition(pos);
    setRejectedNotice(false);
    setSaved(false);
    void fetchAddressFor(pos);
  }

  function handlePickerRejected() {
    setRejectedNotice(true);
  }

  async function handleSave() {
    if (savingRef.current || !session || profile?.id !== session.user.id || isLoading || profileError || !position) return;
    if (!boundary || !isPointInPolygon(position, boundary)) { setRejectedNotice(true); return; }
    savingRef.current = true;
    setSaving(true);
    locationRequestId.current += 1;
    setLocating(false);
    // Freeze the address paired with this pin while its existing save is pending.
    geocodeRequestId.current += 1;
    setAddressLoading(false);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          verified_location: { lat: position.lat, lng: position.lng },
          verified_location_address: address.trim() || null,
          location_verified_at: new Date().toISOString(),
        })
        .eq('id', session.user.id);
      if (error) throw error;
      if (active.current) { setSaved(true); refetch(); }
    } catch {
      if (active.current) Alert.alert('Location not saved', 'Check your connection and choose a pin inside the boundary, then retry.');
    } finally {
      savingRef.current = false;
      if (active.current) setSaving(false);
    }
  }

  // A refresh keeps the map and pin mounted; saving stays blocked while `isLoading`.
  const unavailable = isInitialLoading || !!profileError || profile?.id !== session?.user.id;
  const editingAddress = Platform.OS === 'android' && keyboardVisible && detailsExpanded;
  const footer = <View style={[styles.footer, { backgroundColor: theme.resident.card, borderColor: theme.resident.border, paddingBottom: Math.max(insets.bottom, 24) }]}>
    <PrimaryButton presentation="resident" label={saved ? 'Location Saved ✓' : 'Save My Location'} onPress={handleSave} loading={saving}
      disabled={!position || !boundary || (position !== null && boundary !== null && !isPointInPolygon(position, boundary))} />
  </View>;
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: theme.resident.card }]}>
      <AuthHeader presentation="resident" title="Location Verification" />
      {!session ? <GuestPrompt label="Log in to verify your location." /> : unavailable ? <View style={styles.body}>
        <ThemedText accessibilityLiveRegion="polite" themeColor="textSecondary">{profileError ?? 'Loading your saved location…'}</ThemedText>
        {profileError ? <PrimaryButton presentation="resident" label="Retry" onPress={refetch} /> : null}
      </View> : <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={editingAddress ? styles.mapAreaEditing : [styles.mapArea, !detailsExpanded && styles.mapAreaExpanded]}>
          <MapView key={mapAttempt} markers={[]} boundary={boundary}
            picker={{ enabled: !saving, position }} onPickerMoved={handlePickerMoved} onPickerRejected={handlePickerRejected}
            onMapError={() => setMapError(true)} zoomControlTop={70} style={StyleSheet.absoluteFill} />
          <View style={[styles.hintPill, { backgroundColor: theme.resident.mediaScrim }]} pointerEvents="none">
            <Ionicons name="hand-left-outline" size={16} color={theme.resident.mediaForeground} />
            <ThemedText type="small" style={{ color: theme.resident.mediaForeground }}>{locating ? 'Locating you…' : 'Tap or drag the pin'}</ThemedText>
          </View>
          {rejectedNotice ? <View style={[styles.rejectedBanner, { backgroundColor: theme.resident.dangerSoft, borderColor: theme.resident.danger }]} accessibilityLiveRegion="polite">
            <Ionicons name="warning-outline" size={18} color={theme.resident.danger} />
            <ThemedText type="small" style={{ flex: 1, color: theme.resident.danger }}>Please pin a location inside {profile?.barangays?.name ?? 'the barangay'}'s boundary.</ThemedText>
          </View> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={detailsExpanded ? 'Hide location details' : 'Show location details'}
          accessibilityState={{ expanded: detailsExpanded }}
          onPress={() => {
            Keyboard.dismiss();
            setDetailsExpanded(expanded => !expanded);
          }}
          style={({ pressed }) => [styles.detailsToggle, { backgroundColor: pressed ? theme.resident.accentSoft : theme.resident.card, borderColor: theme.resident.border }]}>
          <ThemedText type="smallBold" style={[styles.detailsToggleLabel, { color: theme.resident.accentText }]}>
            {detailsExpanded ? 'Hide location details' : 'Show location details'}
          </ThemedText>
          <Ionicons name={detailsExpanded ? 'chevron-down' : 'chevron-up'} size={18} color={theme.resident.accentText} />
        </Pressable>
        {detailsExpanded ? <ScrollView style={styles.sheet} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled"
          refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}>
          <ThemedText style={styles.hint} themeColor="textSecondary">Drag the pin to your exact home location inside the barangay boundary, then save.</ThemedText>
          {mapError ? <View style={styles.message} accessibilityLiveRegion="polite">
            <ThemedText style={{ color: theme.resident.danger }}>The map could not load. Check your connection and retry.</ThemedText>
            <PrimaryButton presentation="resident" variant="secondary" label="Retry map" onPress={() => { setMapError(false); setMapAttempt(value => value + 1); }} />
          </View> : null}
          {savedLocation ? <View style={[styles.savedCard, { backgroundColor: theme.resident.surface }]}>
            <View style={styles.savedRow}>
              <Ionicons name="checkmark-circle-outline" size={16} color={theme.resident.accentText} />
              <ThemedText style={[styles.savedTitle, { color: theme.resident.accentText }]}>Previously Saved Location</ThemedText>
            </View>
            <ThemedText style={styles.savedAddress}>{savedAddress ?? 'No address on file'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">{savedLocation.lat.toFixed(5)}, {savedLocation.lng.toFixed(5)}</ThemedText>
          </View> : null}
          <View style={styles.message}>
            <TextField presentation="resident" label="Detected Address" accessibilityLabel="Detected Address" multiline
              placeholder={addressLoading ? 'Detecting address…' : 'Type to correct the detected address'}
              value={address} editable={!saving} maxLength={300} onChangeText={value => {
                geocodeRequestId.current += 1;
                setAddressLoading(false); setAddress(value); setSaved(false); setAddressDetectFailed(false);
              }} error={addressDetectFailed && !address ? "Couldn't detect this address automatically — please type it in." : undefined} />
            <View style={styles.savedRow} accessibilityLiveRegion="polite">
              {addressLoading ? <ActivityIndicator size="small" color={theme.resident.accentText} /> : null}
              <ThemedText type="small" themeColor="textSecondary">{position ? position.lat.toFixed(5) + ', ' + position.lng.toFixed(5) : 'Choose a location on the map'}{addressLoading ? ' · Finding address…' : ''}</ThemedText>
            </View>
          </View>
          {!boundary ? <ThemedText accessibilityLiveRegion="polite" style={{ color: theme.resident.danger }}>The barangay boundary is unavailable. Reopen this screen after your profile has loaded before saving.</ThemedText> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Detect your location"
            accessibilityHint="Moves the pin to your current device location."
            accessibilityState={{ disabled: saving || locating, busy: locating }}
            disabled={saving || locating}
            onPress={handleDetectLocation}
            style={({ pressed }) => [styles.detectButton, {
              backgroundColor: saving ? theme.resident.surface : pressed ? theme.resident.pressed : theme.resident.accentSoft,
              borderColor: saving ? theme.resident.border : theme.resident.accentSoft,
              opacity: pressed ? 0.8 : 1,
            }]}>
            <View style={[styles.detectIcon, { backgroundColor: saving ? theme.resident.border : theme.resident.accent }]} accessible={false} importantForAccessibility="no-hide-descendants">
              {locating ? <ActivityIndicator size="small" color={theme.resident.onAccent} /> : <Ionicons name="locate" size={17} color={saving ? theme.resident.muted : theme.resident.onAccent} />}
            </View>
            <ThemedText type="smallBold" style={[styles.detectLabel, { color: saving ? theme.resident.muted : theme.resident.accentText }]}>
              {locating ? 'Detecting location…' : 'Detect Your Location'}
            </ThemedText>
          </Pressable>
          {editingAddress ? footer : null}
        </ScrollView> : null}
        {editingAddress ? null : footer}
      </KeyboardAvoidingView>}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  mapArea: { flexBasis: '42%', flexShrink: 1, minHeight: 120 },
  mapAreaEditing: { height: 0, overflow: 'hidden' },
  mapAreaExpanded: { flex: 1, flexBasis: 0 },
  detailsToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8, borderTopWidth: 1 },
  detailsToggleLabel: { fontSize: 12, lineHeight: 18 },
  sheet: { flex: 1, minHeight: 80 },
  body: { padding: 20, paddingVertical: 16, gap: 16 },
  message: { gap: 8 },
  detectButton: { alignSelf: 'flex-start', maxWidth: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 7, paddingLeft: 7, paddingRight: 14, borderWidth: 1, borderRadius: 24 },
  detectIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  detectLabel: { fontSize: 13, lineHeight: 18, flexShrink: 1 },
  hint: { fontSize: 14, lineHeight: 20 },
  hintPill: { position: 'absolute', top: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  rejectedBanner: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 14, padding: 12 },
  savedCard: { borderRadius: 16, padding: 16, gap: 6 },
  savedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  savedTitle: { fontSize: 13.5, lineHeight: 20, fontWeight: '700', flexShrink: 1 },
  savedAddress: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12 },
});
