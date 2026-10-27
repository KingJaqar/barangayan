import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecoveryButton } from '@/components/password-recovery-screen';
import { HealthSheet } from '@/components/health/health-presentation';
import { PrimaryButton } from '@/components/primary-button';
import { SettingsSheet } from '@/components/settings-sheet';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { BIRTHDAY_MONTHS, birthdayIso, birthdayParts, daysInBirthdayMonth, limitBirthday, type BirthdayParts } from '@/lib/birthday-wheel';

export const ROW_HEIGHT = 40;
const VISIBLE_ROWS = 7;
export const WHEEL_HEIGHT = ROW_HEIGHT * VISIBLE_ROWS;
export const WHEEL_PADDING = ROW_HEIGHT * Math.floor(VISIBLE_ROWS / 2);
type WheelItem = { value: number; label: string };

export function BirthdayWheelModal({ visible, value, onClose, onConfirm, presentation = 'default' }: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
  presentation?: 'default' | 'resident' | 'profile';
}) {
  if (presentation !== 'default') return <BirthdayWheelContent value={value} visible={visible} presentation={presentation} onClose={onClose} onConfirm={onConfirm} />;
  // A fresh draft on each opening; scrolling and Cancel never change the form.
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    {visible ? <BirthdayWheelContent key={value} visible={visible} value={value} onClose={onClose} onConfirm={onConfirm} /> : null}
  </Modal>;
}

function BirthdayWheelContent({ value, onClose, onConfirm, presentation = 'default', visible = true }: Parameters<typeof BirthdayWheelModal>[0]) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const today = useMemo(() => new Date(), []);
  const [draft, setDraft] = useState(() => birthdayParts(value, today));
  useEffect(() => {
    if (presentation !== 'default' && visible) setDraft(birthdayParts(value, today));
  }, [presentation, visible, value, today]);
  const minimumYear = useMemo(() => Math.min(1900, birthdayParts(value, today).year), [value, today]);
  const years = useMemo(() => Array.from({ length: today.getFullYear() - minimumYear + 1 }, (_, index) => ({ value: minimumYear + index, label: String(minimumYear + index) })), [minimumYear, today]);
  const maximumMonth = draft.year === today.getFullYear() ? today.getMonth() + 1 : 12;
  const months = BIRTHDAY_MONTHS.slice(0, maximumMonth).map((label, index) => ({ value: index + 1, label }));
  const maximumDay = draft.year === today.getFullYear() && draft.month === today.getMonth() + 1 ? today.getDate() : daysInBirthdayMonth(draft.year, draft.month);
  const days = Array.from({ length: maximumDay }, (_, index) => ({ value: index + 1, label: String(index + 1) }));
  function update(part: keyof BirthdayParts, next: number) {
    setDraft(previous => limitBirthday({ ...previous, [part]: next }, today));
  }

  if (presentation === 'profile') return <HealthSheet visible={visible} title="Select Date of Birth" onClose={onClose} scrollable={false}
    footer={<View style={styles.profileFooter}>
      <View style={{ flex: 1 }}><PrimaryButton presentation="resident" label="Close" variant="secondary" onPress={onClose} /></View>
      <View style={{ flex: 1 }}><PrimaryButton presentation="resident" label="Done" onPress={() => onConfirm(birthdayIso(draft))} /></View>
    </View>}>
    <View style={styles.profileWheels}>
      <View pointerEvents="none" style={[styles.profileSelection, { backgroundColor: theme.resident.accentSoft }]} />
      <WheelColumn label="Month" items={months} value={draft.month} onChange={next => update('month', next)} rowHeight={60} visibleRows={5} boldSelected wide />
      <WheelColumn label="Day" items={days} value={draft.day} onChange={next => update('day', next)} rowHeight={60} visibleRows={5} boldSelected />
      <WheelColumn label="Year" items={years} value={draft.year} onChange={next => update('year', next)} rowHeight={60} visibleRows={5} boldSelected />
    </View>
  </HealthSheet>;

  const wheels = <View style={styles.wheels}>
    <View pointerEvents="none" style={[styles.selectedRow, { borderColor: presentation === 'resident' ? theme.resident.border : theme.backgroundSelected }]} />
    <WheelColumn label="Month" items={months} value={draft.month} onChange={next => update('month', next)} wide />
    <WheelColumn label="Day" items={days} value={draft.day} onChange={next => update('day', next)} />
    <WheelColumn label="Year" items={years} value={draft.year} onChange={next => update('year', next)} />
  </View>;
  if (presentation === 'resident') return <SettingsSheet visible={visible} title="Date of birth" onClose={onClose} footer={<>
    <PrimaryButton presentation="resident" label="Use date" onPress={() => onConfirm(birthdayIso(draft))} />
    <PrimaryButton presentation="resident" variant="secondary" label="Not shown on ID" onPress={() => onConfirm('')} />
  </>}>{wheels}</SettingsSheet>;

  return <View style={styles.overlay}>
    <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Cancel birthday selection" onPress={onClose} />
    <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, Spacing.three) }]} accessibilityViewIsModal>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel birthday selection" onPress={onClose} hitSlop={8}><ThemedText themeColor="primary">Cancel</ThemedText></Pressable>
        <ThemedText accessibilityRole="header" type="residentHeader" style={{ fontSize: 14, lineHeight: 20 }}>Date of birth</ThemedText>
        <View style={styles.headerSpacer} />
      </View>
      {wheels}
      <RecoveryButton label="Use date" onPress={() => onConfirm(birthdayIso(draft))} />
      <Pressable accessibilityRole="button" accessibilityLabel="Date of birth not shown on ID" onPress={() => onConfirm('')} style={styles.clear}><ThemedText themeColor="textSecondary" type="small">Not shown on ID</ThemedText></Pressable>
    </View>
  </View>;
}

export function WheelColumn({ label, items, value, onChange, wide = false, rowHeight = ROW_HEIGHT, visibleRows = VISIBLE_ROWS, boldSelected = false }: {
  label: string;
  items: readonly WheelItem[];
  value: number;
  onChange: (value: number) => void;
  wide?: boolean;
  rowHeight?: number;
  visibleRows?: number;
  boldSelected?: boolean;
}) {
  const theme = useTheme();
  const ROW_HEIGHT = rowHeight;
  const wheelHeight = rowHeight * visibleRows;
  const wheelPadding = rowHeight * Math.floor(visibleRows / 2);
  const scroll = useRef<ScrollView>(null);
  const initialized = useRef(false);
  const lastValue = useRef<number | null>(null);
  const selectedIndex = Math.max(0, items.findIndex(item => item.value === value));
  useEffect(() => {
    if (lastValue.current === value) return;
    lastValue.current = value;
    const frame = requestAnimationFrame(() => {
      scroll.current?.scrollTo({ y: selectedIndex * ROW_HEIGHT, animated: false });
      initialized.current = true;
    });
    return () => cancelAnimationFrame(frame);
  }, [value, selectedIndex, items.length, ROW_HEIGHT]);

  function select(index: number) {
    const item = items[Math.max(0, Math.min(index, items.length - 1))];
    if (!item) return;
    lastValue.current = item.value;
    onChange(item.value);
    scroll.current?.scrollTo({ y: items.indexOf(item) * ROW_HEIGHT, animated: false });
  }
  function onScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (!initialized.current) return;
    const index = Math.max(0, Math.min(Math.round(event.nativeEvent.contentOffset.y / ROW_HEIGHT), items.length - 1));
    const next = items[index]?.value;
    if (next !== undefined && next !== lastValue.current) { lastValue.current = next; onChange(next); }
  }
  return <View
    style={[styles.column, wide && styles.monthColumn]}
    accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ text: items[selectedIndex]?.label }}
    accessibilityActions={[{ name: 'increment', label: `Next ${label.toLowerCase()}` }, { name: 'decrement', label: `Previous ${label.toLowerCase()}` }]}
    onAccessibilityAction={event => select(selectedIndex + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}>
    <ScrollView
      ref={scroll}
      testID={`birthday-${label.toLowerCase()}-wheel`}
      style={[styles.wheel, { height: wheelHeight }]}
      contentContainerStyle={{ paddingVertical: wheelPadding }}
      contentOffset={{ x: 0, y: selectedIndex * ROW_HEIGHT }}
      onContentSizeChange={() => { if (!initialized.current) { scroll.current?.scrollTo({ y: selectedIndex * ROW_HEIGHT, animated: false }); initialized.current = true; } }}
      onScroll={onScroll} scrollEventThrottle={16}
      onMomentumScrollEnd={onScroll} onScrollEndDrag={onScroll}
      snapToInterval={ROW_HEIGHT} decelerationRate="fast" bounces={false} nestedScrollEnabled
      showsVerticalScrollIndicator={false} importantForAccessibility="no-hide-descendants">
      {items.map((item, index) => {
        const distance = Math.abs(index - selectedIndex);
        return <Pressable key={item.value} accessible={false} onPress={() => select(index)} style={[styles.wheelRow, { height: rowHeight }]}>
          <ThemedText style={[styles.wheelText, boldSelected && distance === 0 && { fontWeight: '700' }, { color: theme.text, opacity: distance === 0 ? 1 : distance === 1 ? (boldSelected ? 0.7 : 0.45) : distance === 2 ? 0.25 : 0.1 }]} numberOfLines={1}>{item.label}</ThemedText>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  profileFooter: { flexDirection: 'row', gap: 12 },
  profileWheels: { flexDirection: 'row', height: 300, position: 'relative' },
  profileSelection: { position: 'absolute', left: 0, right: 0, top: 120, height: 60, borderRadius: 12 },
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: Spacing.four, paddingTop: Spacing.three, gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerSpacer: { width: 52 },
  wheels: { flexDirection: 'row', height: WHEEL_HEIGHT, position: 'relative' },
  selectedRow: { position: 'absolute', left: 0, right: 0, top: WHEEL_PADDING, height: ROW_HEIGHT, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth },
  column: { flex: 1 },
  monthColumn: { flex: 2 },
  wheel: { height: WHEEL_HEIGHT },
  wheelContent: { paddingVertical: WHEEL_PADDING },
  wheelRow: { height: ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' },
  wheelText: { fontSize: 22, lineHeight: 30, fontWeight: '400' },
  clear: { alignItems: 'center', paddingVertical: Spacing.two },
});
