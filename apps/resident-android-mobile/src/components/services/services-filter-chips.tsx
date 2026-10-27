import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { CountBadge } from '@/components/count-badge';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

export interface ServicesFilterOption<Key extends string> {
  key: Key;
  label: string;
  /** Shown after the label ("Active 2"); omit while the number is still loading. */
  count?: number;
  /** Shows the count as a round badge in this color (the Reports tab badge style) instead of plain text. */
  badge?: string;
}

export const filterOptionLabel = ({ label, count }: { label: string; count?: number }) => count === undefined ? label : `${label} ${count}`;

function FilterChip({ label, text, selected, onPress, badge }: { label: string; text: string; selected: boolean; onPress: () => void; badge?: ReactNode }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const [pressed, setPressed] = useState(false);
  const color = selected ? (pressed ? resident.accentPressed : resident.accent) : (pressed ? resident.pressed : resident.surface);
  const fill = useSharedValue(color);
  useEffect(() => {
    fill.value = reducedMotion ? color : withTiming(color, { duration: 150, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    return () => cancelAnimation(fill);
  }, [color, fill, reducedMotion]);
  const feedback = useAnimatedStyle(() => ({ backgroundColor: fill.value }));
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)} style={styles.chipHit}>
    <Animated.View style={[styles.chip, { borderColor: selected && resident.accentNeedsOutline ? resident.controlBorder : 'transparent' }, feedback]}>
      <ThemedText type="smallBold" style={[styles.chipLabel, { color: selected ? (pressed ? resident.onAccentPressed : resident.onAccent) : resident.text }]}>{text}</ThemedText>
      {badge}
    </Animated.View>
  </Pressable>;
}

/** Scrollable pill filters shared by Documents and Requests, or compact underline tabs for a sub-row. */
export function ServicesFilterChips<Key extends string>({
  options,
  activeKey,
  onChange,
  label = 'filters',
  compact = false,
}: {
  options: ServicesFilterOption<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  /** Accessible name of the scrolling row. */
  label?: string;
  compact?: boolean;
}) {
  if (compact) return <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusTabs}>
    <SegmentedControl segments={options.map(option => ({ key: option.key, label: filterOptionLabel(option) }))}
      activeKey={activeKey} onChange={onChange} sizing="content" variant="underline" presentation="resident" />
  </ScrollView>;
  return (
    <ScrollableChevronRow label={label} contentContainerStyle={styles.chipRow}>
      {options.map(option => {
        // Badged chips show the number as a round badge; zero hides it, leaving just the label.
        const badged = option.badge !== undefined;
        return <FilterChip key={option.key} label={filterOptionLabel(option)} text={badged ? option.label : filterOptionLabel(option)}
          selected={option.key === activeKey} onPress={() => onChange(option.key)}
          badge={badged && option.count ? <CountBadge count={option.count} background={option.badge!} presentation="resident" size={20} outlineWidth={0} /> : undefined} />;
      })}
    </ScrollableChevronRow>
  );
}

const styles = StyleSheet.create({
  chipRow: { paddingHorizontal: 20, paddingVertical: 4, alignItems: 'center', gap: 8 },
  chipHit: { minHeight: 44, justifyContent: 'center' },
  chip: { minHeight: 32, flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: 13.5, lineHeight: 20 },
  statusTabs: { marginHorizontal: 20 },
});
