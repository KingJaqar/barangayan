/**
 * Full-screen map picker for Incident Reports' Location section — lets the resident drop
 * (or drag) a pin anywhere inside the barangay boundary, auto-fetches the pin's address via
 * reverse geocoding, and lets them correct that address by typing before confirming.
 *
 * The boundary constraint is enforced by MapView itself (it validates every tap/drag
 * against the `boundary` prop and snaps the pin back on a rejected move) — this component
 * just surfaces that rejection as a transient banner.
 */
import { Ionicons } from '@expo/vector-icons';
import type { LatLng } from '@barangayan/shared';
import { reverseGeocode } from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

import { MapView } from '@/components/map-view';

export interface LocationPickerResult {
  position: LatLng;
  address: string | null;
}

interface LocationPickerModalProps {
  visible: boolean;
  /** Where the pin starts — the resident's current GPS fix, a previous pick, or the barangay centroid. */
  initialPosition: LatLng | null;
  initialAddress?: string | null;
  boundary: Polygon | MultiPolygon | null;
  barangayName?: string | null;
  onCancel: () => void;
  onConfirm: (result: LocationPickerResult) => void;
}

export function LocationPickerModal({
  visible,
  initialPosition,
  initialAddress,
  boundary,
  barangayName,
  onCancel,
  onConfirm,
}: LocationPickerModalProps) {
  const theme = useTheme();
  const [position, setPosition] = useState<LatLng | null>(initialPosition);
  const [address, setAddress] = useState(initialAddress ?? '');
  const [addressLoading, setAddressLoading] = useState(false);
  const [rejectedNotice, setRejectedNotice] = useState(false);
  const geocodeRequestId = useRef(0);

  async function fetchAddressFor(pos: LatLng) {
    const requestId = ++geocodeRequestId.current;
    setAddressLoading(true);
    const result = await reverseGeocode(pos);
    // Ignore stale responses from a since-superseded pin placement.
    if (requestId !== geocodeRequestId.current) return;
    setAddressLoading(false);
    if (result) setAddress(result);
  }

  // Reset to the caller's starting point each time the modal opens, and auto-fetch its
  // address if one wasn't already known (e.g. reopening after a previous confirm).
  useEffect(() => {
    if (!visible) return;
    setPosition(initialPosition);
    setAddress(initialAddress ?? '');
    setRejectedNotice(false);
    if (initialPosition && !initialAddress) {
      void fetchAddressFor(initialPosition);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handlePickerMoved(pos: LatLng) {
    setPosition(pos);
    setRejectedNotice(false);
    void fetchAddressFor(pos);
  }

  function handlePickerRejected() {
    setRejectedNotice(true);
  }

  function handleConfirm() {
    if (!position) return;
    onConfirm({ position, address: address.trim() || null });
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onCancel} statusBarTranslucent>
      <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: theme.backgroundSelected }]}>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            hitSlop={Spacing.two}
            style={styles.headerBtn}>
            <Ionicons name="close" size={24} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold" style={styles.headerTitle}>
            Pin Your Location
          </ThemedText>
          <View style={styles.headerBtn} />
        </View>

        {/* Map */}
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
              Tap or drag the pin
            </ThemedText>
          </View>
          {rejectedNotice && (
            <View style={styles.rejectedBanner}>
              <Ionicons name="warning-outline" size={16} color="#fff" />
              <ThemedText type="small" style={styles.rejectedBannerText}>
                Please pin a location inside {barangayName ?? 'the barangay'}&apos;s boundary.
              </ThemedText>
            </View>
          )}
        </View>

        {/* Confirm sheet */}
        <ThemedView type="backgroundElement" style={[styles.sheet, { borderTopColor: theme.backgroundSelected }]}>
          <View style={styles.addressLabelRow}>
            <ThemedText type="small" style={[styles.sectionLabel, { color: theme.primary }]}>
              Address
            </ThemedText>
            {addressLoading && <ActivityIndicator size="small" color={theme.primary} />}
          </View>
          <TextField
            placeholder={addressLoading ? 'Detecting address…' : 'Type to correct the detected address'}
            value={address}
            onChangeText={setAddress}
            maxLength={300}
          />
          {position && (
            <ThemedText type="small" themeColor="textSecondary">
              {position.lat.toFixed(5)}, {position.lng.toFixed(5)}
            </ThemedText>
          )}
          <PrimaryButton label="Use This Location" onPress={handleConfirm} disabled={!position} />
        </ThemedView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
  },
  mapArea: {
    flex: 1,
  },
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
  hintPillText: {
    color: '#fff',
  },
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
  rejectedBannerText: {
    color: '#fff',
    flex: 1,
  },
  sheet: {
    padding: Spacing.four,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  addressLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
