import Constants, { ExecutionEnvironment } from 'expo-constants';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import Animated, {
  Easing as ReanimatedEasing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useEvacuationCenters } from '@/hooks/use-evacuation-centers';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';

// expo-media-library's native module isn't built into Expo Go — merely *importing* it
// there throws synchronously while the module evaluates, before any try/catch around the
// call site gets a chance to run (same trap expo-notifications has in
// lib/push-notifications.ts). Check this first and never import the module at all inside
// Expo Go, rather than trying to catch our way out of it.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

interface QrShowModalProps {
  visible: boolean;
  onClose: () => void;
}

// How far below the viewport the sheet starts / exits to.
// 800 is safely off-screen on any phone.
const SHEET_OFFSET = 800;

export function QrShowModal({ visible, onClose }: QrShowModalProps) {
  const theme = useTheme();
  const { profile } = useProfile();
  const barangayId = profile?.barangay_id ?? null;
  const { centers, isLoading: centersLoading } = useEvacuationCenters({ barangayId });
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [showCenterPicker, setShowCenterPicker] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const qrFrameRef = useRef<View>(null);

  // ── Animation ──────────────────────────────────────────────────────────────
  // Keep a local "modal open" flag so we can play the exit animation before
  // handing control back to the parent.
  const [localVisible, setLocalVisible] = useState(false);

  const sheetY = useSharedValue(SHEET_OFFSET);
  const backdropAlpha = useSharedValue(0);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: sheetY.value }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: backdropAlpha.value,
  }));

  // Open: spring up, fade backdrop in.
  useEffect(() => {
    if (visible) {
      setLocalVisible(true);
      sheetY.value = SHEET_OFFSET; // ensure starting below screen
      backdropAlpha.value = 0;
      sheetY.value = withSpring(0, {
        damping: 22,
        stiffness: 200,
        mass: 0.85,
        overshootClamping: false,
      });
      backdropAlpha.value = withTiming(1, { duration: 260 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Dismiss: ease the sheet down, then signal the parent.
  const handleClose = useCallback(() => {
    sheetY.value = withTiming(SHEET_OFFSET, {
      duration: 320,
      easing: ReanimatedEasing.in(ReanimatedEasing.cubic),
    }, (finished) => {
      if (finished) runOnJS(setLocalVisible)(false);
      // Delay onClose by one frame so the native modal can unmount cleanly.
      if (finished) runOnJS(onClose)();
    });
    backdropAlpha.value = withTiming(0, { duration: 260 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);
  // ── End Animation ──────────────────────────────────────────────────────────

  const selectedCenter = centers.find((c) => c.id === selectedCenterId) ?? null;

  useEffect(() => {
    if (visible && centers.length > 0 && !selectedCenterId) {
      setSelectedCenterId(centers[0].id);
    }
  }, [visible, centers, selectedCenterId]);

  useEffect(() => {
    if (!visible) {
      setShowCenterPicker(false);
    }
  }, [visible]);

  const qrPayload = selectedCenter
    ? {
      type: 'EVACUATION_CENTER_CHECKIN',
      version: '1.0',
      center_id: selectedCenter.id,
      center_name: selectedCenter.name,
      barangay_id: barangayId ?? '',
      generated_at: new Date().toISOString(),
    }
    : null;

  const parsedPayload = qrPayload ? evacuationCenterQrPayloadSchema.safeParse(qrPayload) : null;
  const qrValue = parsedPayload?.success ? JSON.stringify(parsedPayload.data) : '';

  const handleShare = useCallback(async () => {
    if (!qrValue) return;
    try {
      await Share.share({
        message: `Evacuation Center Check-in QR\n\n${qrValue}`,
        title: 'Evacuation Center QR Code',
      });
    } catch {
      // Share cancelled
    }
  }, [qrValue]);

  const handleDownloadQr = useCallback(async () => {
    if (!qrFrameRef.current || downloading || !selectedCenter) return;
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Downloading QR codes is not supported on web.');
      return;
    }
    if (isExpoGo) {
      Alert.alert(
        'Development Build Required',
        'Saving QR codes to your photo gallery requires a development build. In Expo Go, use Share instead.'
      );
      return;
    }
    setDownloading(true);
    try {
      const expoMediaLibrary = await import('expo-media-library');
      const { Asset, Album, requestPermissionsAsync } = expoMediaLibrary;
      const { status } = await requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library access to download the QR code.');
        setDownloading(false);
        return;
      }

      const uri = await captureRef(qrFrameRef, {
        format: 'png',
        quality: 1,
      });

      const asset = await Asset.create(uri);
      await Album.create('Barangayan QR Codes', [asset]);

      Alert.alert('Success', 'QR code saved to your photo gallery.');
    } catch {
      Alert.alert('Error', 'Failed to download QR code. Please try again.');
    } finally {
      setDownloading(false);
    }
  }, [downloading, selectedCenter]);

  const handleSelectCenter = useCallback((centerId: string) => {
    setSelectedCenterId(centerId);
    setShowCenterPicker(false);
  }, []);

  return (
    <Modal visible={localVisible} transparent animationType="none" onRequestClose={handleClose}>
      {/* Animated dim backdrop */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.overlayDim, backdropStyle]} pointerEvents="none" />

      <Pressable style={styles.overlay} onPress={handleClose}>
        {/* Animated sheet */}
        <Animated.View style={sheetStyle}>
        <Pressable style={[styles.container, { backgroundColor: theme.background }]} onPress={() => { }}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <ThemedText type="smallBold" style={[styles.title, { color: theme.text }]}>
              Show QR Code
            </ThemedText>
            <Pressable onPress={handleClose} hitSlop={Spacing.two}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <Pressable
            style={[styles.centerPicker, { borderColor: theme.backgroundSelected }]}
            onPress={() => setShowCenterPicker(true)}>
            <View style={styles.centerPickerContent}>
              <Ionicons name="location-outline" size={20} color={theme.primary} />
              <ThemedText style={[styles.centerPickerText, { color: theme.text }]}>
                {selectedCenter ? selectedCenter.name : 'Select Evacuation Center'}
              </ThemedText>
              <Ionicons name="chevron-down" size={20} color={theme.textSecondary} />
            </View>
          </Pressable>

          {selectedCenter && (
            <View style={styles.centerInfo}>
              <Ionicons name="map-outline" size={16} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={styles.centerAddress}>
                {selectedCenter.address ?? 'No address provided'}
              </ThemedText>
            </View>
          )}

          <View ref={qrFrameRef} collapsable={false} style={[styles.qrFrame, { borderColor: theme.backgroundSelected }]}>
            {centersLoading ? (
              <ThemedText themeColor="textSecondary">Loading centers...</ThemedText>
            ) : !selectedCenter ? (
              <ThemedText themeColor="textSecondary">Select a center to generate QR</ThemedText>
            ) : !qrValue ? (
              <ThemedText themeColor="textSecondary">Unable to generate QR code</ThemedText>
            ) : (
              <QRCode value={qrValue} size={220} backgroundColor="#FFFFFF" color="#000000" />
            )}
          </View>

          <ThemedText themeColor="textSecondary" style={styles.helperText}>
            Show this screen to center staff so they can scan it at the desk.
          </ThemedText>

          <Pressable
            style={[styles.shareButton, { backgroundColor: theme.primary }]}
            onPress={handleShare}
            disabled={!qrValue}>
            <Ionicons name="share-outline" size={20} color={theme.onPrimary} />
            <ThemedText style={[styles.shareButtonText, { color: theme.onPrimary }]}>
              Share QR Code
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.downloadButton, { backgroundColor: theme.background, borderColor: theme.primary, borderWidth: 1 }]}
            onPress={handleDownloadQr}
            disabled={!qrValue || downloading}>
            <Ionicons
              name={downloading ? 'reload' : 'download-outline'}
              size={20}
              color={theme.primary}
            />
            <ThemedText style={[styles.downloadButtonText, { color: theme.primary }]}>
              {downloading ? 'Saving...' : 'Download QR'}
            </ThemedText>
          </Pressable>
        </Pressable>
        </Animated.View>
      </Pressable>

      <Modal visible={showCenterPicker} transparent animationType="fade" onRequestClose={() => setShowCenterPicker(false)}>
        <Pressable style={styles.pickerOverlay} onPress={() => setShowCenterPicker(false)}>
          <Pressable style={[styles.pickerContainer, { backgroundColor: theme.background }]} onPress={() => { }}>
            <View style={styles.pickerHeader}>
              <ThemedText type="smallBold" style={[styles.pickerTitle, { color: theme.text }]}>
                Select Evacuation Center
              </ThemedText>
              <Pressable onPress={() => setShowCenterPicker(false)} hitSlop={Spacing.two}>
                <Ionicons name="close" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.pickerList}>
              {centersLoading ? (
                <ThemedText themeColor="textSecondary" style={styles.pickerEmpty}>
                  Loading centers...
                </ThemedText>
              ) : centers.length === 0 ? (
                <ThemedText themeColor="textSecondary" style={styles.pickerEmpty}>
                  No evacuation centers found.
                </ThemedText>
              ) : (
                centers.map((center) => (
                  <Pressable
                    key={center.id}
                    style={[
                      styles.pickerItem,
                      { backgroundColor: center.id === selectedCenterId ? theme.primary + '15' : 'transparent' },
                    ]}
                    onPress={() => handleSelectCenter(center.id)}>
                    <View style={styles.pickerItemContent}>
                      <Ionicons
                        name="location-outline"
                        size={20}
                        color={center.id === selectedCenterId ? theme.primary : theme.textSecondary}
                      />
                      <View style={styles.pickerItemText}>
                        <ThemedText style={[styles.pickerItemName, { color: theme.text }]}>
                          {center.name}
                        </ThemedText>
                        {center.address ? (
                          <ThemedText themeColor="textSecondary" style={styles.pickerItemAddress}>
                            {center.address}
                          </ThemedText>
                        ) : null}
                      </View>
                    </View>
                    {center.id === selectedCenterId && (
                      <Ionicons name="checkmark" size={20} color={theme.primary} />
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayDim: {
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.four,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  centerPicker: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  centerPickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  centerPickerText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
  },
  centerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: -Spacing.two,
  },
  centerAddress: {
    fontSize: 13,
    lineHeight: 18,
  },
  qrFrame: {
    width: 260,
    height: 260,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    alignSelf: 'center',
  },
  helperText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: 26,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: 26,
  },
  downloadButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  pickerContainer: {
    borderRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    maxWidth: 600,
    maxHeight: '80%',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerEmpty: {
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: 12,
    marginBottom: Spacing.one,
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flex: 1,
  },
  pickerItemText: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickerItemAddress: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
});
