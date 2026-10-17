import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Body, Sheet } from '../../components/ui';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import {
  dateIso, FIRST_CALENDAR_YEAR, formatDriveDate, formatMonth, LAST_CALENDAR_YEAR, monthGrid, MONTH_NAMES, shiftMonth, type DriveCategory, type MonthRef,
} from './drive-model';

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

function ArrowButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  const type = useType();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minWidth: layout.controlMin, minHeight: layout.controlMin, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}>
    <Text style={[type.title2, { color: colors.primary }]}>{label.startsWith('Previous') ? '‹' : '›'}</Text>
  </Pressable>;
}

/**
 * A month of days for choosing a drive date. Each day is a button that names its date, whether it is today or selected, and how
 * many drives are scheduled; the colored dots (up to three categories) repeat what that count says, so they are never the only cue.
 */
export function DriveCalendar({ month, today, selected, dots, counts, onShift, onSelect, onOpenPicker }: {
  month: MonthRef;
  today: string;
  /** The chosen day, or null while the whole month is being viewed. */
  selected: string | null;
  dots: Record<string, DriveCategory[]>;
  counts: Record<string, number>;
  onShift: (delta: 1 | -1) => void;
  onSelect: (date: string) => void;
  onOpenPicker: () => void;
}) {
  const colors = useColors();
  const type = useType();
  const weeks = monthGrid(month);
  const atStart = shiftMonth(month, -1) === month;
  const atEnd = shiftMonth(month, 1) === month;
  return <View style={{ gap: space[2] }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <ArrowButton label="Previous month" onPress={() => onShift(-1)} disabled={atStart} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${formatMonth(month)}. Choose month and year`} onPress={onOpenPicker}
        style={({ pressed }) => ({ minHeight: layout.controlMin, justifyContent: 'center', paddingHorizontal: space[3], opacity: pressed ? 0.6 : 1 })}>
        <Text accessibilityRole="header" style={[type.headline, { color: colors.primary }]}>{formatMonth(month)}</Text>
      </Pressable>
      <ArrowButton label="Next month" onPress={() => onShift(1)} disabled={atEnd} />
    </View>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row' }}>
      {WEEKDAY_LETTERS.map((letter, index) => <Text key={index} style={[type.caption, { flex: 1, textAlign: 'center', color: colors.textSecondary }]}>{letter}</Text>)}
    </View>
    {weeks.map((week, row) => <View key={row} style={{ flexDirection: 'row' }}>
      {week.map((day, column) => {
        if (day === null) return <View key={column} style={{ flex: 1 }} />;
        const date = dateIso(month, day);
        const isSelected = date === selected;
        const isToday = date === today;
        const count = counts[date] ?? 0;
        const label = `${formatDriveDate(date)}${isToday ? ', today' : ''}, ${count === 0 ? 'no drives' : count === 1 ? '1 drive' : `${count} drives`}`;
        return <Pressable key={column} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: isSelected }} onPress={() => onSelect(date)}
          style={{ flex: 1, minHeight: layout.controlMin, alignItems: 'center', justifyContent: 'center', gap: 2 }}>
          <View style={{ minWidth: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: isSelected ? colors.primary : 'transparent', borderWidth: isToday && !isSelected ? 1.5 : 0, borderColor: colors.primary }}>
            <Text style={[type.callout, { color: isSelected ? colors.onPrimary : colors.textPrimary, fontWeight: isToday || isSelected ? '700' : '400' }]}>{day}</Text>
          </View>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', gap: 3, height: 6 }}>
            {(dots[date] ?? []).map((dot) => <View key={dot.type} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dot.color }} />)}
          </View>
        </Pressable>;
      })}
    </View>)}
  </View>;
}

/** Jump straight to a month and year. The choice is a draft until Apply; closing the sheet changes nothing. */
export function MonthPickerSheet({ visible, month, onApply, onClose }: { visible: boolean; month: MonthRef; onApply: (month: MonthRef) => void; onClose: () => void }) {
  return <Sheet visible={visible} title="Choose month and year" onClose={onClose}>
    <MonthPickerBody month={month} onApply={onApply} onClose={onClose} />
  </Sheet>;
}

function Choice({ label, selected, onPress, minWidth = layout.controlMin }: { label: string; selected: boolean; onPress: () => void; minWidth?: number }) {
  const colors = useColors();
  const type = useType();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    style={{ minHeight: layout.controlMin, minWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2], borderRadius: radius.sm, borderCurve: 'continuous', borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceSelected : colors.surface }}>
    <Text style={[type.callout, { color: colors.textPrimary, fontWeight: selected ? '700' : '400' }]}>{label}</Text>
  </Pressable>;
}

function MonthPickerBody({ month, onApply, onClose }: { month: MonthRef; onApply: (month: MonthRef) => void; onClose: () => void }) {
  const colors = useColors();
  const type = useType();
  const [draft, setDraft] = useState(month);
  const moveYear = (delta: number) => setDraft((current) => ({ ...current, year: Math.max(FIRST_CALENDAR_YEAR, Math.min(LAST_CALENDAR_YEAR, current.year + delta)) }));
  return <>
    <Body role="headline">{formatMonth(draft)}</Body>
    <View accessibilityRole="adjustable" accessibilityLabel="Year" accessibilityValue={{ text: String(draft.year) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => moveYear(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Choice label="Earlier year" selected={false} minWidth={layout.buttonMinHeight} onPress={() => moveYear(-1)} />
      <Text accessibilityElementsHidden style={[type.title2, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>{draft.year}</Text>
      <Choice label="Later year" selected={false} minWidth={layout.buttonMinHeight} onPress={() => moveYear(1)} />
    </View>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {MONTH_NAMES.map((name, index) => <Choice key={name} label={name} selected={draft.month === index + 1} minWidth={104} onPress={() => setDraft((current) => ({ ...current, month: index + 1 }))} />)}
    </View>
    <View style={{ gap: space[3], marginTop: space[3] }}>
      <Action label={`Show ${formatMonth(draft)}`} onPress={() => { onApply(draft); onClose(); }} />
      <Action label="Cancel" secondary onPress={onClose} />
    </View>
  </>;
}
