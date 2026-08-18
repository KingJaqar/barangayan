import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export interface FilterChip<K extends string> {
  key: K;
  label: string;
  /** Fill colour when active; outline colour when inactive. */
  color: string;
}

/**
 * The horizontal pill filter row used by the Reports tab.
 *
 * Extracted verbatim from the Announcements feed so the Incident Reports filters are
 * pixel-identical to it rather than a look-alike reimplementation — both segments now
 * render this same component.
 */
export function FilterChips<K extends string>({
  chips,
  active,
  onSelect,
}: {
  chips: FilterChip<K>[];
  active: K;
  onSelect: (key: K) => void;
}) {
  return (
    // `alignItems: 'center'` is the critical fix — without it the horizontal ScrollView
    // stretches each Pressable child to fill its full cross-axis height (the "tall pill" bug).
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={chipStyles.row}>
      {chips.map(({ key, label, color }) => {
        const isActive = active === key;
        return (
          <Pressable
            key={key}
            onPress={() => onSelect(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={[
              chipStyles.chip,
              isActive
                ? { backgroundColor: color }
                : { borderWidth: 1.5, borderColor: color },
            ]}>
            <ThemedText
              type="small"
              style={[chipStyles.chipLabel, { color: isActive ? '#ffffff' : color }]}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const chipStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',   // ← prevents cross-axis stretch; keeps chips compact pill height
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.one,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    alignSelf: 'center',   // belt-and-suspenders for any edge-case nesting
  },
  chipLabel: {
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 20,
  },
});
