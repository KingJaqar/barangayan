import { useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { authSetupRequests } from '@/lib/setup-request';

export function GuestBrowseButton({ disabled = false }: { disabled?: boolean }) {
  const router = useRouter();
  const { setGuest } = useAuth();
  const theme = useTheme();
  return (
    <Pressable
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityHint="Browse public updates. You can log in or create an account later."
      style={({ pressed }) => [styles.action, { opacity: disabled ? 0.5 : pressed ? 0.6 : 1 }]}
      onPress={() => {
        if (authSetupRequests.busy) {
          Alert.alert('Please wait', 'An account request is still finishing. Please wait before browsing as a guest.');
          return;
        }
        setGuest(true);
        router.replace('/home');
      }}>
      <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Browse as guest</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  action: { minHeight: 48, alignSelf: 'center', justifyContent: 'center', paddingHorizontal: 20, paddingVertical: 12 },
  label: { fontSize: 14, lineHeight: 22, fontWeight: '600', textAlign: 'center', textDecorationLine: 'underline' },
});
