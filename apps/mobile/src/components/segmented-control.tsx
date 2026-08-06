import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentOption<Key extends string> {
  key: Key;
  label: string;
}

export interface SegmentedControlProps<Key extends string> {
  segments: SegmentOption<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  /** Locked design decision: the Maps (Emergency & DRRM) section's List/Map toggle uses a
   * red active pill instead of the default brand green — see AGENTS.md §4. */
  activeColor?: 'primary' | 'accentRed';
}

/**
 * The pill-row segmented control used throughout the design file (Services'
 * Documents/Requests/Logs, Reports' Incident Reports/Active/Resolved/Announcements,
 * Health's Active Drives/My Registrations, Maps' List/Map toggle). Not the same as the
 * bottom NativeTabs bar — this is an in-page switcher implemented with plain React state
 * per Expo Router's own guidance for secondary in-page tab bars.
 */
export function SegmentedControl<Key extends string>({
  segments,
  activeKey,
  onChange,
  activeColor = 'primary',
}: SegmentedControlProps<Key>) {
  const theme = useTheme();
  const activeBg = activeColor === 'accentRed' ? Colors.light.accentRed : theme.primary;

  return (
    <ThemedView type="backgroundElement" style={styles.container}>
      {segments.map((segment) => {
        const isActive = segment.key === activeKey;
        return (
          <Pressable
            key={segment.key}
            onPress={() => onChange(segment.key)}
            style={styles.segmentPressable}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}>
            <View style={[styles.segment, isActive && { backgroundColor: activeBg }]}>
              <ThemedText
                type="small"
                themeColor={isActive ? undefined : 'textSecondary'}
                style={isActive ? { color: theme.onPrimary } : undefined}>
                {segment.label}
              </ThemedText>
            </View>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  segmentPressable: {
    flex: 1,
  },
  segment: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderRadius: Spacing.three,
  },
});
