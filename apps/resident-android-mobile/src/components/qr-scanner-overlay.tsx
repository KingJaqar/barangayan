import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { useIsFocused } from 'expo-router';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';

import { ThemedText } from '@/components/themed-text';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';

export function QrScannerOverlay({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { resident } = useTheme();
  const focused = useIsFocused();
  const { session } = useAuth();
  const { profile } = useProfile();
  const owner = session?.user.id ?? null;
  const barangayId = profile?.barangay_id ?? null;
  const [active, setActive] = useState(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [message, setMessage] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState(false);
  const [ready, setReady] = useState(false);
  const [finderSize, setFinderSize] = useState({ width: 0, height: 0 });
  const frameSize = Math.max(0, Math.min(256, finderSize.width - 48, finderSize.height - 24));
  const lock = useRef(false);
  const eligible = useRef(false);
  const activeOwner = useRef(owner);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const shown = visible && focused && active && !!owner && !!barangayId;
  const { mounted, panel } = useReportModalMotion(shown, 200);

  useEffect(() => {
    eligible.current = shown;
    activeOwner.current = owner;
    if (shown) {
      lock.current = false;
      setMessage(null);
      setCameraError(false);
      setReady(false);
    }
    return () => { eligible.current = false; };
  }, [shown, owner, barangayId]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      setActive(state === 'active');
      if (state !== 'active') {
        eligible.current = false;
        if (visible) closeRef.current();
      }
    });
    if (visible && !focused) closeRef.current();
    return () => listener.remove();
  }, [visible, focused]);

  function close() {
    eligible.current = false;
    onClose();
  }

  function handleBarcodeScanned(event: BarcodeScanningResult) {
    if (!eligible.current || activeOwner.current !== owner || lock.current) return;
    lock.current = true;
    let payload: unknown;
    try { payload = event.data.length <= 2048 ? JSON.parse(event.data.trim()) : null; } catch { payload = null; }
    const parsed = evacuationCenterQrPayloadSchema.safeParse(payload);
    if (!parsed.success) { setMessage('This is not a valid evacuation center check-in QR code.'); return; }
    if (parsed.data.barangay_id !== barangayId) { setMessage('This QR code belongs to a different barangay.'); return; }
    setMessage('Ask barangay staff to scan your Family QR and confirm who is present. This scan did not record attendance.');
  }

  return <Modal visible={mounted} animationType="none" presentationStyle="fullScreen" onRequestClose={close}>
    <SafeAreaProvider style={{ flex: 1, backgroundColor: resident.mediaBackdrop }}>
      <Animated.View style={[styles.root, { opacity: panel }]}>
        <SafeAreaView style={styles.root}>
          <View style={styles.header}>
            <Pressable onPress={close} style={styles.close} accessibilityRole="button" accessibilityLabel="Close QR scanner"><Ionicons name="close" size={24} color={resident.mediaForeground} /></Pressable>
            <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, { color: resident.mediaForeground }]}>Scan QR Code</ThemedText>
            <View style={styles.close} />
          </View>
          <View style={styles.finder} onLayout={({ nativeEvent: { layout } }) => {
            setFinderSize(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height });
          }}>
            {shown && !message && !cameraError ? <CameraView style={StyleSheet.absoluteFill} facing="back"
              onCameraReady={() => { if (eligible.current) setReady(true); }} onMountError={() => { if (eligible.current) setCameraError(true); }}
              onBarcodeScanned={handleBarcodeScanned} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} /> : null}
            <View pointerEvents="none" style={[styles.mask, { backgroundColor: resident.mediaScrim, top: 0, left: 0, right: 0, height: (finderSize.height - frameSize) / 2 }]} />
            <View pointerEvents="none" style={[styles.mask, { backgroundColor: resident.mediaScrim, bottom: 0, left: 0, right: 0, height: (finderSize.height - frameSize) / 2 }]} />
            <View pointerEvents="none" style={[styles.mask, { backgroundColor: resident.mediaScrim, top: (finderSize.height - frameSize) / 2, left: 0, height: frameSize, width: (finderSize.width - frameSize) / 2 }]} />
            <View pointerEvents="none" style={[styles.mask, { backgroundColor: resident.mediaScrim, top: (finderSize.height - frameSize) / 2, right: 0, height: frameSize, width: (finderSize.width - frameSize) / 2 }]} />
            <View style={[styles.frame, { width: frameSize, height: frameSize }]}>
              {(['tl', 'tr', 'bl', 'br'] as const).map(corner => <View key={corner} style={[styles.corner, styles[corner], { borderColor: resident.accent }]} />)}
              {cameraError ? <View style={styles.cameraState}><Ionicons name="videocam-off-outline" size={32} color={resident.mediaForeground} />
                <ThemedText accessibilityRole="alert" style={[styles.feedback, { color: resident.mediaForeground }]}>Camera unavailable. Check camera access in Settings, or try again.</ThemedText>
                <Pressable onPress={() => { setReady(false); setCameraError(false); }} accessibilityRole="button" style={styles.retry}><ThemedText style={{ color: resident.mediaForeground }}>Retry camera</ThemedText></Pressable>
              </View> : shown && !ready && !message ? <ActivityIndicator color={resident.mediaForeground} accessibilityLabel="Starting camera" /> : null}
            </View>
          </View>
          <View style={styles.footer}>
            <ThemedText accessibilityLiveRegion="polite" style={[styles.feedback, { color: resident.mediaForeground }]}>{message ?? 'Position the barangay QR code within the frame'}</ThemedText>
            {message ? <Pressable accessibilityRole="button" onPress={close} style={styles.retry}><ThemedText style={{ color: resident.mediaForeground }}>Close scanner</ThemedText></Pressable> : null}
          </View>
        </SafeAreaView>
      </Animated.View>
    </SafeAreaProvider>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, minHeight: 56 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 17, fontWeight: '700', textAlign: 'center' },
  finder: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  frame: { borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', width: 48, height: 48 },
  mask: { position: 'absolute' },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 24 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 24 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 24 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 24 },
  footer: { paddingHorizontal: 32, paddingTop: 24, paddingBottom: 40, gap: 12, alignItems: 'center' },
  feedback: { fontSize: 15, lineHeight: 24, textAlign: 'center' },
  cameraState: { padding: 24, gap: 8, alignItems: 'center' },
  retry: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
