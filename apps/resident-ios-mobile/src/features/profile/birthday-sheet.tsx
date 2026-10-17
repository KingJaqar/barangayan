import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Body, Sheet } from '../../components/ui';
import { layout, radius, space, useType, useColors } from '../../lib/theme';
import {
  BIRTHDAY_MONTHS, birthdayIso, birthdayLabel, limitBirthday, pickerStart, selectableDays, selectableMonths,
  type BirthdayParts,
} from './birthday';

function Choice({ label, selected, onPress, minWidth = layout.controlMin }: { label: string; selected: boolean; onPress: () => void; minWidth?: number }) {
  const colors = useColors();
  const type = useType();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} onPress={onPress}
    style={{ minHeight: layout.controlMin, minWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space[2], borderRadius: radius.sm, borderCurve: 'continuous', borderWidth: 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceSelected : 'transparent' }}>
    <Text style={[type.callout, { color: colors.textPrimary, fontWeight: selected ? '700' : '400' }]}>{label}</Text>
  </Pressable>;
}

/**
 * Month, year and day selection in a native sheet. The chosen date is a draft: nothing
 * changes in the form until Apply, and Cancel (or closing the sheet) leaves the saved
 * value as it was. Only dates that exist and are not in the future can be chosen.
 */
export function BirthdaySheet({ visible, value, onApply, onClose, title = 'Date of birth' }: { visible: boolean; value: string; onApply: (iso: string) => void; onClose: () => void; title?: string }) {
  // The sheet's content mounts fresh on every open, so the draft always starts from the saved value.
  return <Sheet visible={visible} title={title} onClose={onClose}><BirthdayBody value={value} onApply={onApply} onClose={onClose} applyLabel={`Apply ${title.toLowerCase()}`} /></Sheet>;
}

function BirthdayBody({ value, onApply, onClose, applyLabel }: { value: string; onApply: (iso: string) => void; onClose: () => void; applyLabel: string }) {
  const colors = useColors();
  const type = useType();
  const [parts, setParts] = useState<BirthdayParts>(() => pickerStart(value));
  const today = new Date();
  const move = (change: Partial<BirthdayParts>) => setParts((current) => limitBirthday({ ...current, ...change }, today));
  return <>
    <Body role="headline">{birthdayLabel(birthdayIso(parts))}</Body>
    <View accessibilityRole="adjustable" accessibilityLabel="Year" accessibilityValue={{ text: String(parts.year) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => move({ year: parts.year + (event.nativeEvent.actionName === 'increment' ? 1 : -1) })}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <Choice label="Earlier year" selected={false} minWidth={layout.buttonMinHeight} onPress={() => move({ year: parts.year - 1 })} />
      <Text accessibilityElementsHidden style={[type.title2, { color: colors.textPrimary, flex: 1, textAlign: 'center' }]}>{parts.year}</Text>
      <Choice label="Later year" selected={false} minWidth={layout.buttonMinHeight} onPress={() => move({ year: parts.year + 1 })} />
    </View>
    <View style={{ flexDirection: 'row', gap: space[2] }}>
      <Choice label="10 years earlier" selected={false} minWidth={140} onPress={() => move({ year: parts.year - 10 })} />
      <Choice label="10 years later" selected={false} minWidth={140} onPress={() => move({ year: parts.year + 10 })} />
    </View>
    <Body role="subheadline" tone="secondary">Month</Body>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {selectableMonths(parts.year, today).map((month) => <Choice key={month} label={BIRTHDAY_MONTHS[month - 1]} selected={parts.month === month} minWidth={96} onPress={() => move({ month })} />)}
    </View>
    <Body role="subheadline" tone="secondary">Day</Body>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
      {selectableDays(parts.year, parts.month, today).map((day) => <Choice key={day} label={String(day)} selected={parts.day === day} onPress={() => move({ day })} />)}
    </View>
    <View style={{ gap: space[3], marginTop: space[3] }}>
      <Action label={applyLabel} onPress={() => onApply(birthdayIso(parts))} />
      <Action label="Cancel" secondary onPress={onClose} />
    </View>
  </>;
}
