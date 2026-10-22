import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ServicesPanel, serviceListStyles } from '@/components/services/services-list-presentation';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Shared empty/error/loading presentation for the Documents, Requests and Logs tabs.
 * Purely visual — callers keep owning their own data, retry and copy. */

export function ServicesEmptyState({
  icon,
  title,
  message,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
}) {
  const theme = useTheme();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: theme.resident.surface }]}>
        <Ionicons name={icon} size={28} color={theme.resident.muted} accessible={false} />
      </View>
      <ThemedText type="heading" style={styles.stateTitle}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText type="small" themeColor="textSecondary" style={styles.stateMessage}>
          {message}
        </ThemedText>
      ) : null}
    </View>
  );
}

export function ServicesErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.state}>
      <View style={[styles.stateIcon, { backgroundColor: theme.resident.dangerSoft }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.resident.danger} accessible={false} />
      </View>
      <ThemedText accessibilityRole="alert" themeColor="textSecondary" style={styles.stateMessage}>
        {message}
      </ThemedText>
      <View style={styles.retry}>
        <PrimaryButton label={retryLabel} presentation="resident" onPress={onRetry} />
      </View>
    </View>
  );
}

/** Static grouped placeholders keep loading legible without a decorative loop. */
export function ServicesListSkeleton({ rows = 4 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.skeletonList} accessibilityLabel="Loading" accessibilityState={{ busy: true }}>
      <ServicesPanel>
        {Array.from({ length: rows }, (_, index) => (
          <View
            key={index}
            style={[
              serviceListStyles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: theme.resident.border },
            ]}>
            <View style={[serviceListStyles.icon, { backgroundColor: theme.resident.surface }]} />
            <View style={styles.skeletonText}>
              <View style={[styles.placeholder, { width: '65%', height: 16, backgroundColor: theme.resident.surface }]} />
              <View style={[styles.placeholder, { width: '85%', backgroundColor: theme.resident.surface }]} />
              <View style={[styles.placeholder, { width: '40%', backgroundColor: theme.resident.surface }]} />
            </View>
          </View>
        ))}
      </ServicesPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    gap: Spacing.two,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  stateTitle: {
    textAlign: 'center',
  },
  stateMessage: {
    textAlign: 'center',
  },
  retry: {
    alignSelf: 'stretch',
    marginTop: Spacing.two,
  },
  skeletonList: {
    paddingHorizontal: 20,
  },
  placeholder: { height: 12, borderRadius: 4 },
  skeletonText: {
    flex: 1,
    gap: Spacing.two,
  },
});
