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
import { reverseGeocode } from '@barangayan/shared';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { GuestPrompt } from '@/components/guest-prompt';
import { AMPID_I_SAN_MATEO_CENTER, MapView } from '@/components/map-view';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function LocationVerificationScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const { session } = useAuth();
  const { profile, isLoading, refetch } = useProfile();

  const boundary = (profile?.barangays?.boundary as unknown as Polygon | MultiPolygon | null) ?? null;
  const savedLocation = (profile as any)?.verified_location as LatLng | null | undefined;
  const savedAddress = (profile as any)?.verified_location_address as string | null | undefined;

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
  const geocodeRequestId = useRef(0);

  async function fetchAddressFor(pos: LatLng) {
    const requestId = ++geocodeRequestId.current;
    setAddressLoading(true);
    setAddressDetectFailed(false);
    const result = await reverseGeocode(pos);
    // Ignore stale responses from a since-superseded pin placement.
    if (requestId !== geocodeRequestId.current) return;
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
    setLocating(true);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelled) setPosition(AMPID_I_SAN_MATEO_CENTER);
          return;
        }
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!cancelled) {
          setPosition(point);
          void fetchAddressFor(point);
        }
      } catch {
        if (!cancelled) setPosition(AMPID_I_SAN_MATEO_CENTER);
      } finally {
        if (!cancelled) setLocating(false);
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
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Needed',
          'Allow Barangayan to access your device location in Settings, then try again.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setPosition(point);
      setRejectedNotice(false);
      setSaved(false);
      void fetchAddressFor(point);
    } catch {
      Alert.alert('Location Unavailable', "Couldn't detect your current location. Please try again or drag the pin manually.");
    } finally {
      setLocating(false);
    }
  }

  function handlePickerMoved(pos: LatLng) {
    setPosition(pos);
    setRejectedNotice(false);
    setSaved(false);
    void fetchAddressFor(pos);
  }

  function handlePickerRejected() {
    setRejectedNotice(true);
  }

  async function handleSave() {
    if (!session || !position) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        verified_location: position as any,
        verified_location_address: address.trim() || null,
        location_verified_at: new Date().toISOString(),
      } as any)
      .eq('id', session.user.id);
    setSaving(false);
    if (error) {
      setRejectedNotice(false);
      return;
    }
    setSaved(true);
    refetch();
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={Spacing.two}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
              Location Verification
            </ThemedText>
          </View>
        </View>

        {!session ? (
          <GuestPrompt label="Log in to verify your location." />
        ) : (
          <>
            <View style={styles.mapArea}>
              <MapView
                markers={[]}
                boundary={boundary}
                picker={{ enabled: true, position }}
                onPickerMoved={handlePickerMoved}
                onPickerRejected={handlePickerRejected}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.hintPill} pointerEvents="none">
                <Ionicons name="hand-left-outline" size={13} color="#fff" />
                <ThemedText type="small" style={styles.hintPillText}>
                  {locating ? 'Locating you…' : 'Tap or drag the pin'}
                </ThemedText>
              </View>
              {rejectedNotice && (
                <View style={styles.rejectedBanner}>
                  <Ionicons name="warning-outline" size={16} color="#fff" />
                  <ThemedText type="small" style={styles.rejectedBannerText}>
                    Please pin a location inside {profile?.barangays?.name ?? 'the barangay'}&apos;s boundary.
                  </ThemedText>
                </View>
              )}
            </View>

            <ScrollView
              style={[styles.sheet, { backgroundColor: theme.backgroundElement, borderTopColor: theme.backgroundSelected }]}
              contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.three, gap: Spacing.two }}
              keyboardShouldPersistTaps="handled">
              <ThemedText themeColor="textSecondary" style={styles.sheetHint}>
                Drag the pin to your exact home location inside the barangay boundary, then save.
              </ThemedText>

              {/* Previously saved location — a static reference to what's actually on file
                  right now (profile.verified_location*), independent of the pin below. It
                  does not change as the pin is dragged; only a successful Save updates it. */}
              {savedLocation && (
                <View style={[styles.savedCard, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
                  <View style={styles.savedRow}>
                    <Ionicons name="checkmark-circle" size={14} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary, fontWeight: '700' }}>
                      Previously Saved Location
                    </ThemedText>
                  </View>
                  <ThemedText type="small">{savedAddress ?? 'No address on file'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {savedLocation.lat.toFixed(5)}, {savedLocation.lng.toFixed(5)}
                  </ThemedText>
                </View>
              )}

              <View style={styles.addressLabelRow}>
                <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
                  Detected Address
                </ThemedText>
                {addressLoading && <ActivityIndicator size="small" color={theme.primary} />}
              </View>
              <TextField
                placeholder={addressLoading ? 'Detecting address…' : 'Type to correct the detected address'}
                value={address}
                onChangeText={(v) => {
                  setAddress(v);
                  setSaved(false);
                  setAddressDetectFailed(false);
                }}
                maxLength={300}
                error={addressDetectFailed && !address ? "Couldn't detect this address automatically — please type it in." : undefined}
              />

              {position && (
                <ThemedText type="small" themeColor="textSecondary">
                  {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
                </ThemedText>
              )}
              <PrimaryButton
                label="📍 Detect Your Location"
                variant="secondary"
                onPress={handleDetectLocation}
                loading={locating}
                disabled={isLoading}
              />
              <PrimaryButton
                label={saved ? 'Location Saved ✓' : 'Save My Location'}
                onPress={handleSave}
                loading={saving}
                disabled={!position || isLoading}
              />
            </ScrollView>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
  },
  mapArea: { flex: 1 },
  hintPill: {
    position: 'absolute',
    top: Spacing.three,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hintPillText: { color: '#fff' },
  rejectedBanner: {
    position: 'absolute',
    bottom: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rejectedBannerText: { color: '#fff', flex: 1 },
  // Capped so the map above (mapArea, flex: 1) always gets the majority of the
  // screen — without a cap this ScrollView sizes to its content and, with the
  // "Previously Saved Location" card showing, was squeezing the map down to a
  // sliver. Content still fits without scrolling in the common case; the
  // ScrollView is there for smaller devices / longer detected addresses.
  sheet: {
    maxHeight: '34%',
    padding: Spacing.three,
    gap: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sheetHint: { lineHeight: 18 },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  savedCard: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: 2,
  },
});
