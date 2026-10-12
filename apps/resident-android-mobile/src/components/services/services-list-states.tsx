import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { SkeletonBlock } from '@/components/services/skeleton';
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
      <View style={[styles.stateIcon, { backgroundColor: theme.backgroundElement }]}>
        <Ionicons name={icon} size={28} color={theme.textSecondary} />
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
      <View style={[styles.stateIcon, { backgroundColor: `${theme.accentRed}1A` }]}>
        <Ionicons name="cloud-offline-outline" size={28} color={theme.accentRed} />
      </View>
      <ThemedText accessibilityRole="alert" themeColor="textSecondary" style={styles.stateMessage}>
        {message}
      </ThemedText>
      <View style={styles.retry}>
        <PrimaryButton label={retryLabel} onPress={onRetry} />
      </View>
    </View>
  );
}

/** Airbnb-style shimmering rows that mirror the final row layout while data loads. */
export function ServicesListSkeleton({ rows = 4 }: { rows?: number }) {
  const theme = useTheme();
  return (
    <View style={styles.skeletonList} accessibilityLabel="Loading">
      {Array.from({ length: rows }, (_, index) => (
        <View
          key={index}
          style={[
            styles.skeletonRow,
            { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
          ]}>
          <SkeletonBlock width={56} height={56} borderRadius={16} />
          <View style={styles.skeletonText}>
            <SkeletonBlock width="65%" height={16} />
            <SkeletonBlock width="85%" height={12} />
            <SkeletonBlock width="40%" height={12} />
          </View>
        </View>
      ))}
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
    gap: Spacing.three,
    paddingHorizontal: 20,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skeletonText: {
    flex: 1,
    gap: Spacing.two,
  },
});
