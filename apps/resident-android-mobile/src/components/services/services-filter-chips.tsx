import { type ComponentProps, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { CountBadge } from '@/components/count-badge';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface ServicesFilterOption<Key extends string> {
  key: Key;
  label: string;
  /** Shown after the label ("Active 2"); omit while the number is still loading. */
  count?: number;
  /** Shows the count as a round badge in this color (the Reports tab badge style) instead of plain text. */
  badge?: string;
  /** Compact status tabs show this icon instead of the visible label. */
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export const filterOptionLabel = ({ label, count }: { label: string; count?: number }) => count === undefined ? label : `${label} ${count}`;

function FilterChip({ label, text, selected, onPress, badge }: { label: string; text: string; selected: boolean; onPress: () => void; badge?: ReactNode }) {
  const { resident } = useTheme();
  return <Pressable accessibilityRole="tab" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    style={styles.chipHit}>
    {({ pressed }) => <View style={[styles.chip, {
      backgroundColor: selected ? (pressed ? resident.accentPressed : resident.accent) : (pressed ? resident.pressed : resident.surface),
      borderColor: selected && resident.accentNeedsOutline ? resident.controlBorder : 'transparent',
    }]}>
      <ThemedText type="smallBold" style={[styles.chipLabel, { color: selected ? (pressed ? resident.onAccentPressed : resident.onAccent) : resident.text }]}>{text}</ThemedText>
      {badge}
    </View>}
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
  const { resident } = useTheme();
  const badge = (option: ServicesFilterOption<Key>) => option.badge && option.count
    ? <CountBadge count={option.count} background={option.badge} presentation="resident" size={20} outlineWidth={0} /> : undefined;
  if (compact) return <View style={styles.statusTabs}>
    <SegmentedControl segments={options.map(option => ({
      key: option.key,
      label: option.icon ? '' : filterOptionLabel(option),
      accessibilityLabel: filterOptionLabel(option),
      accessory: option.icon ? <View style={styles.statusIcon}>
        <Ionicons name={option.icon} size={20} color={option.key === activeKey ? resident.accentText : resident.muted} accessible={false} />
        {badge(option)}
      </View> : undefined,
    }))}
      activeKey={activeKey} onChange={onChange} sizing="equal" variant="underline" presentation="resident" />
  </View>;
  return (
    <View accessibilityRole="tablist" accessibilityLabel={label}>
    <ScrollableChevronRow label={label} contentContainerStyle={styles.chipRow}>
      {options.map(option => {
        // Badged chips show the number as a round badge; zero hides it, leaving just the label.
        const badged = option.badge !== undefined;
        return <FilterChip key={option.key} label={filterOptionLabel(option)} text={badged ? option.label : filterOptionLabel(option)}
          selected={option.key === activeKey} onPress={() => onChange(option.key)}
          badge={badge(option)} />;
      })}
    </ScrollableChevronRow>
    </View>
  );
}

const styles = StyleSheet.create({
  chipRow: { paddingHorizontal: 20, paddingVertical: 4, alignItems: 'center', gap: 8 },
  chipHit: { minHeight: 44, justifyContent: 'center' },
  chip: { minHeight: 32, flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 100, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chipLabel: { fontSize: 13.5, lineHeight: 20 },
  statusTabs: { marginHorizontal: 20 },
  statusIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
