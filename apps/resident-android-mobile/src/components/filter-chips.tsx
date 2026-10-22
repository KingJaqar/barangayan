import { Pressable, StyleSheet, View } from 'react-native';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface FilterChip<K extends string> { key: K; label: string; color: string }

export function FilterChips<K extends string>({ chips, active, onSelect }: {
  chips: FilterChip<K>[]; active: K; onSelect: (key: K) => void;
}) {
  const { resident } = useTheme();
  return <ScrollableChevronRow label="filters" contentContainerStyle={styles.row}>
    {chips.map(({ key, label, color }) => {
      const selected = active === key;
      return <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected }}
        onPress={() => onSelect(key)} style={({ pressed }) => [styles.chip, {
          backgroundColor: selected ? (pressed ? resident.accentPressed : resident.accent) : pressed ? resident.pressed : resident.surface,
          borderColor: selected && resident.accentNeedsOutline ? resident.controlBorder : 'transparent',
        }]}>
        {({ pressed }) => <><View style={[styles.dot, { backgroundColor: selected ? (pressed ? resident.onAccentPressed : resident.onAccent) : color }]} />
          <ThemedText style={[styles.label, { color: selected ? (pressed ? resident.onAccentPressed : resident.onAccent) : resident.text }]}>{label}</ThemedText></>}
      </Pressable>;
    })}
  </ScrollableChevronRow>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  chip: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 100, paddingHorizontal: 16, paddingVertical: 6 },
  label: { fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
