import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useProfile } from '@/hooks/use-profile';
import { useAuth } from '@/hooks/use-auth';

interface HouseholdQrModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HouseholdQrModal({ visible, onClose }: HouseholdQrModalProps) {
  const theme = useTheme();
  const { profile } = useProfile();
  const { session } = useAuth();
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && profile?.id && session?.access_token) {
      setLoading(true);
      const url = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/generate-household-qr?profileId=${profile.id}`;
      setQrUrl(url);
      setLoading(false);
    }
  }, [visible, profile?.id, session?.access_token]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={[styles.container, { backgroundColor: theme.background }]} onPress={() => {}}>
          <View style={styles.handle} />
          <ThemedText type="smallBold" style={[styles.title, { color: theme.text }]}>
            Household QR Code
          </ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.subtitle}>
            Present this code at evacuation centers for quick family check-in.
          </ThemedText>

          <View style={[styles.qrFrame, { borderColor: theme.backgroundSelected }]}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : qrUrl && session?.access_token ? (
              <Image
                source={{ uri: qrUrl, headers: { Authorization: `Bearer ${session.access_token}` } }}
                style={styles.qrImage}
                contentFit="contain"
                cachePolicy="memory-disk"
              />
            ) : (
              <Ionicons name="qr-code-outline" size={80} color={theme.textSecondary} />
            )}
          </View>

          <ThemedText type="small" themeColor="textSecondary" style={styles.householdName}>
            {(profile as any)?.full_name ?? 'Your Household'}
          </ThemedText>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <ThemedText style={[styles.closeText, { color: Colors.light.primary }]}>Close</ThemedText>
          </Pressable>
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
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    alignItems: 'center',
    gap: Spacing.three,
    width: '100%',
    maxWidth: 360,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    textAlign: 'center',
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
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  qrImage: {
    width: 240,
    height: 240,
  },
  householdName: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  closeButton: {
    marginTop: Spacing.two,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
