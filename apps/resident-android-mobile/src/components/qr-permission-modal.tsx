import { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { Camera } from 'expo-camera';
import * as Linking from 'expo-linking';
import { Ionicons } from '@expo/vector-icons';
import { ScanFamilySheet } from '@/components/drrm/scan-family-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function QrPermissionModal({ visible, onClose, onGranted }: {
  visible: boolean; onClose: () => void; onGranted: () => void;
}) {
  const { resident } = useTheme();
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  const pending = useRef(false);
  const grantedRef = useRef(onGranted);
  useEffect(() => { grantedRef.current = onGranted; }, [onGranted]);

  useEffect(() => {
    const ticket = ++generation.current;
    if (!visible) return;
    setError(null);
    async function read() {
      try {
        const result = await Camera.getCameraPermissionsAsync();
        if (generation.current !== ticket) return;
        setCanAskAgain(result.canAskAgain);
        if (result.granted) { generation.current += 1; grantedRef.current(); }
      } catch { if (generation.current === ticket) setError('Could not check camera permission. Try again.'); }
    }
    void read();
    const foreground = AppState.addEventListener('change', state => { if (state === 'active' && !pending.current) void read(); });
    return () => { generation.current += 1; foreground.remove(); };
  }, [visible]);

  async function grant() {
    if (pending.current) return;
    const ticket = generation.current;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (!canAskAgain) { await Linking.openSettings(); return; }
      const result = await Camera.requestCameraPermissionsAsync();
      if (generation.current !== ticket) return;
      setCanAskAgain(result.canAskAgain);
      if (result.granted) { generation.current += 1; grantedRef.current(); }
      else setError('Camera access was denied. You can grant access or open Settings to try again.');
    } catch { if (generation.current === ticket) setError('Could not open camera permissions. Please try again.'); }
    finally { pending.current = false; setBusy(false); }
  }
  function close() { generation.current += 1; onClose(); }
  return <ScanFamilySheet visible={visible} title="Camera Access Needed" picker onClose={close}>
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Ionicons name="camera-outline" size={40} color={resident.accentText} />
      <ThemedText style={{ color: resident.muted, textAlign: 'center', fontSize: 14, lineHeight: 20 }}>Barangayan needs camera access to scan evacuation center QR codes for check-in.</ThemedText>
      {error ? <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>{error}</ThemedText> : null}
      <View style={{ alignSelf: 'stretch', gap: 12 }}>
        <PrimaryButton presentation="resident" label={canAskAgain ? 'Grant Access' : 'Open Settings'} loading={busy} onPress={grant} />
        <PrimaryButton presentation="resident" variant="secondary" label="Cancel" onPress={close} />
      </View>
    </View>
  </ScanFamilySheet>;
}
