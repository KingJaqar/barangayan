import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, BarcodeScanningResult } from 'expo-camera';

import { Ionicons } from '@expo/vector-icons';
import { Spacing } from '@/constants/theme';
import { useQrCheckins } from '@/hooks/use-qr-checkins';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { evacuationCenterQrPayloadSchema } from '@barangayan/shared';
import type { EvacuationCenterQrPayload } from '@barangayan/shared';

interface QrScannerOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function QrScannerOverlay({ visible, onClose }: QrScannerOverlayProps) {
  const [scanning, setScanning] = useState(false);
  const { checkIn, updateHouseholdStatus } = useQrCheckins();
  const { session } = useAuth();
  const { profile } = useProfile();

  if (!visible) return null;

  async function handleBarcodeScanned(event: BarcodeScanningResult) {
    if (scanning) return;
    setScanning(true);

    try {
      const raw = event.data.trim();
      if (!raw) {
        Alert.alert('Invalid QR', 'This QR code does not contain a valid evacuation center ID.');
        setScanning(false);
        return;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(raw);
      } catch {
        Alert.alert('Invalid QR', 'This QR code does not contain a valid payload.');
        setScanning(false);
        return;
      }

      const parsed = evacuationCenterQrPayloadSchema.safeParse(payload);
      if (!parsed.success) {
        Alert.alert('Invalid QR', 'This QR code is not a valid evacuation center check-in code.');
        setScanning(false);
        return;
      }

      const qrData = parsed.data as EvacuationCenterQrPayload;

      if (qrData.barangay_id !== profile?.barangay_id) {
        Alert.alert('Wrong Barangay', 'This QR code belongs to a different barangay.');
        setScanning(false);
        return;
      }

      const result = await checkIn(qrData.center_id);
      if (result) {
        const householdUpdated = await updateHouseholdStatus();
        if (!householdUpdated && session?.user?.id) {
          Alert.alert('Warning', 'Check-in recorded, but could not update household status.');
        }

        Alert.alert('Check-in Recorded', 'Your presence has been registered at the evacuation center.', [
          { text: 'OK', onPress: () => { onClose(); setScanning(false); } },
        ]);
      } else {
        Alert.alert('Error', 'Could not record your check-in. Please try again.');
        setScanning(false);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong while processing the QR code.');
      setScanning(false);
    }
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing="back"
        onBarcodeScanned={scanning ? undefined : handleBarcodeScanned}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
      />

      <View style={[styles.topBar, { paddingTop: Platform.select({ ios: 50, android: 20 }) }]}>
        <Pressable onPress={onClose} style={styles.closeButton} hitSlop={Spacing.two}>
          <Ionicons name="close" size={28} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.scanTitle}>Scan QR Code</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.scanFrame}>
        <View style={styles.cornerTL} />
        <View style={styles.cornerTR} />
        <View style={styles.cornerBL} />
        <View style={styles.cornerBR} />
      </View>

      <View style={styles.bottomBar}>
        <Text style={styles.instruction}>Position the barangay QR code within the frame</Text>
        {scanning && (
          <View style={styles.processingRow}>
            <ActivityIndicator size="small" color="#FFFFFF" />
            <Text style={styles.processingText}>Processing...</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    zIndex: 100,
  },
  camera: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    zIndex: 10,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '600',
  },
  scanFrame: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    height: 220,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  cornerTL: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopColor: '#0F6E5B',
    borderLeftColor: '#0F6E5B',
    borderTopLeftRadius: 24,
  },
  cornerTR: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 40,
    height: 40,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopColor: '#0F6E5B',
    borderRightColor: '#0F6E5B',
    borderTopRightRadius: 24,
  },
  cornerBL: {
    position: 'absolute',
    bottom: -2,
    left: -2,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomColor: '#0F6E5B',
    borderLeftColor: '#0F6E5B',
    borderBottomLeftRadius: 24,
  },
  cornerBR: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 40,
    height: 40,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomColor: '#0F6E5B',
    borderRightColor: '#0F6E5B',
    borderBottomRightRadius: 24,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.six,
  },
  instruction: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    opacity: 0.9,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
