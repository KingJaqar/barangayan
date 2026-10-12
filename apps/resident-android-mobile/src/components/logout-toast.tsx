import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

export function LogoutToast() {
  const { logoutNotice, dismissLogoutNotice } = useAuth();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!logoutNotice) return;
    const timer = setTimeout(dismissLogoutNotice, 4_000);
    return () => clearTimeout(timer);
  }, [logoutNotice, dismissLogoutNotice]);
  if (!logoutNotice) return null;
  return (
    <View pointerEvents="none" style={[styles.position, { bottom: insets.bottom + 16 }]}>
      <View style={[styles.toast, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]} accessibilityLiveRegion="polite">
        <Ionicons name="checkmark-circle" size={22} color={theme.primary} importantForAccessibility="no" />
        <ThemedText style={styles.message}>You have been logged out</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  position: { position: 'absolute', left: 24, right: 24, alignItems: 'center' },
  toast: { maxWidth: 360, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingVertical: 14, borderRadius: 16, borderWidth: 1, elevation: 4 },
  message: { flexShrink: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
});
