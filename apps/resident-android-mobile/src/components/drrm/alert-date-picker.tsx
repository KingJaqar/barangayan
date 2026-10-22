import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { ALERT_MONTHS, alertYearOptions, type AlertDateFilter } from '@/lib/emergency-alert-filter';

const DAYS = ['', ...Array.from({ length: 31 }, (_, index) => String(index + 1))];
const MONTHS = ['', ...ALERT_MONTHS];

export function AlertDatePicker({ value, active, onChange, onApply, onClear }: {
  value: AlertDateFilter;
  active: boolean;
  onChange: (value: AlertDateFilter) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  const { resident } = useTheme();
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  useEffect(() => {
    if (!active) return;
    const refreshYear = () => setCurrentYear(new Date().getFullYear());
    refreshYear();
    // Only the open picker checks the clock; React skips updates within the same year.
    const timer = setInterval(refreshYear, 60_000);
    return () => clearInterval(timer);
  }, [active]);
  const years = alertYearOptions(currentYear);
  return <View style={[styles.panel, { borderColor: resident.border, backgroundColor: resident.card }]}>
    <View style={styles.wheels}>
      <AlertWheel label="Month" items={MONTHS} value={value.month} onChange={month => onChange({ ...value, month })} />
      <AlertWheel label="Day" items={DAYS} value={value.day} onChange={day => onChange({ ...value, day })} />
      <AlertWheel label="Year" items={years} value={value.year} onChange={year => onChange({ ...value, year })} />
    </View>
    <ThemedText style={[styles.hint, { color: resident.muted }]}>Choose Any for an unset part.</ThemedText>
    <View style={styles.actions}>
      <View style={styles.action}><PrimaryButton presentation="resident" compact variant="secondary" label="Clear" onPress={onClear} /></View>
      <View style={styles.action}><PrimaryButton presentation="resident" compact label="Apply date filter" onPress={onApply} /></View>
    </View>
  </View>;
}

function AlertWheel({ label, items, value, onChange }: {
  label: string; items: readonly string[]; value: string; onChange: (value: string) => void;
}) {
  const { resident } = useTheme();
  const reduced = useResidentReducedMotion(true);
  const { fontScale } = useWindowDimensions();
  const rowHeight = Math.max(44, Math.ceil(28 * fontScale));
  const padding = rowHeight;
  const scroll = useRef<ScrollView>(null);
  const lastValue = useRef(value);
  const index = Math.max(0, items.indexOf(value));
  useEffect(() => {
    if (lastValue.current === value) return;
    lastValue.current = value;
    scroll.current?.scrollTo({ y: index * rowHeight, animated: false });
  }, [value, index, rowHeight]);

  function select(nextIndex: number, animated: boolean) {
    const next = items[Math.max(0, Math.min(nextIndex, items.length - 1))];
    if (next === undefined) return;
    lastValue.current = next;
    onChange(next);
    scroll.current?.scrollTo({ y: items.indexOf(next) * rowHeight, animated: animated && !reduced });
  }
  function settle(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const next = items[Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.y / rowHeight), items.length - 1))];
    if (next !== undefined && next !== lastValue.current) { lastValue.current = next; onChange(next); }
  }
  const selectedLabel = value ? label === 'Month' ? value.slice(0, 3) : value : 'Any';
  return <View style={styles.column}>
    <ThemedText style={[styles.label, { color: resident.muted }]}>{label}</ThemedText>
    <View style={{ height: rowHeight * 3 }} accessible accessibilityRole="adjustable" accessibilityLabel={label}
      accessibilityValue={{ text: selectedLabel }} accessibilityActions={[{ name: 'increment', label: `Next ${label.toLowerCase()}` }, { name: 'decrement', label: `Previous ${label.toLowerCase()}` }]}
      onAccessibilityAction={event => {
        if (event.nativeEvent.actionName === 'increment') select(index + 1, false);
        else if (event.nativeEvent.actionName === 'decrement') select(index - 1, false);
      }}>
      <View pointerEvents="none" style={[styles.selection, { top: padding, height: rowHeight, backgroundColor: resident.accentSoft }]} />
      <ScrollView ref={scroll} testID={`alert-${label.toLowerCase()}-wheel`} nestedScrollEnabled
        showsVerticalScrollIndicator={false} bounces={false} decelerationRate="fast" snapToInterval={rowHeight}
        contentContainerStyle={{ paddingVertical: padding }} contentOffset={{ x: 0, y: index * rowHeight }}
        onLayout={() => scroll.current?.scrollTo({ y: index * rowHeight, animated: false })}
        onMomentumScrollEnd={settle} onScrollEndDrag={settle} importantForAccessibility="no-hide-descendants">
        {items.map((item, itemIndex) => <Pressable key={item} accessible={false} onPress={() => select(itemIndex, true)} style={[styles.wheelRow, { height: rowHeight }]}>
          <ThemedText numberOfLines={1} style={[styles.wheelText, { color: itemIndex === index ? resident.accentText : resident.muted,
            fontWeight: itemIndex === index ? '700' : '500', opacity: itemIndex === index ? 1 : Math.abs(itemIndex - index) === 1 ? 0.75 : 0.4 }]}>
            {item ? label === 'Month' ? item.slice(0, 3) : item : 'Any'}
          </ThemedText>
        </Pressable>)}
      </ScrollView>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  panel: { borderWidth: 1, borderRadius: 16, padding: 12, marginTop: 4, gap: 8 },
  wheels: { flexDirection: 'row', gap: 4 },
  column: { flex: 1, minWidth: 0 },
  label: { fontSize: 11.5, lineHeight: 17, fontWeight: '700', textAlign: 'center', marginBottom: 4 },
  selection: { position: 'absolute', left: 4, right: 4, borderRadius: 12 },
  wheelRow: { alignItems: 'center', justifyContent: 'center' },
  wheelText: { fontSize: 16, lineHeight: 24 },
  hint: { fontSize: 12, lineHeight: 18 },
  actions: { flexDirection: 'row', gap: 8 },
  action: { flex: 1, minWidth: 0 },
});
