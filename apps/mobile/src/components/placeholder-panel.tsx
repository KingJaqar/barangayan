import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

/**
 * Scaffolding placeholder for a segment/screen whose real content lands in a later task
 * (see the plan's "30% Progress" milestone task breakdown). Navigation/segmented-control
 * mechanics around it are already real — only the content inside is a stand-in.
 */
export function PlaceholderPanel({ label }: { label: string }) {
  return (
    <ThemedView style={styles.container}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
