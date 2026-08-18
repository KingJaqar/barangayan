import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useCountdown } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}

/** "Expires in HH:MM:SS" pill counting down to a fixed expiry timestamp (unix ms). */
export function CountdownTimer({ expiresAt }: { expiresAt: number }) {
  const theme = useTheme();
  const remaining = useCountdown(expiresAt) ?? 0;

  return (
    <View style={[styles.pill, { backgroundColor: `${theme.primary}1A` }]}>
      <ThemedText type="small" style={{ color: theme.primary }}>
        {remaining <= 0 ? 'Expired' : `Expires in ${formatRemaining(remaining)}`}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
});
