import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Camera } from 'expo-camera';
import * as Linking from 'expo-linking';

import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface QrPermissionModalProps {
  visible: boolean;
  onClose: () => void;
  onGranted: () => void;
}

export function QrPermissionModal({ visible, onClose, onGranted }: QrPermissionModalProps) {
  const theme = useTheme();
  const [canAskAgain, setCanAskAgain] = useState(true);
  const [status, setStatus] = useState<'undetermined' | 'denied' | 'granted'>('undetermined');

  useEffect(() => {
    if (visible) {
      Camera.getCameraPermissionsAsync().then((result) => {
        setStatus(result.status === 'granted' ? 'granted' : (result.status as 'denied' | 'undetermined'));
        setCanAskAgain(result.canAskAgain ?? false);
      });
    }
  }, [visible]);

  async function handleGrantAccess() {
    const result = await Camera.requestCameraPermissionsAsync();
    if (result.status === 'granted') {
      onGranted();
    } else {
      setCanAskAgain(result.canAskAgain ?? false);
      setStatus(result.status as 'denied' | 'undetermined');
    }
  }

  function handleOpenSettings() {
    Linking.openSettings();
  }

  const isPermanentlyDenied = status !== 'granted' && !canAskAgain;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: theme.background }]} onPress={() => {}}>
          <View style={styles.iconContainer}>
            <Ionicons name="camera-outline" size={48} color={theme.primary} />
          </View>
          <ThemedText type="smallBold" style={[styles.title, { color: theme.text }]}>
            Camera Access Needed
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.body}>
            Barangayan needs camera access to scan evacuation center QR codes for check-in.
          </ThemedText>

          <View style={styles.buttonRow}>
            {isPermanentlyDenied ? (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handleOpenSettings}>
                <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                  Open Settings
                </ThemedText>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.primaryButton, { backgroundColor: theme.primary }]}
                onPress={handleGrantAccess}>
                <ThemedText style={[styles.primaryButtonText, { color: theme.onPrimary }]}>
                  Grant Access
                </ThemedText>
              </Pressable>
            )}
            <Pressable
              style={[styles.secondaryButton, { borderColor: theme.primary }]}
              onPress={onClose}>
              <ThemedText style={[styles.secondaryButtonText, { color: theme.primary }]}>
                Cancel
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  container: {
    borderRadius: 24,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.six,
    alignItems: 'center',
    gap: Spacing.four,
    width: '100%',
    maxWidth: 340,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.light.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'column',
    gap: Spacing.two,
    width: '100%',
    marginTop: Spacing.two,
  },
  primaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
