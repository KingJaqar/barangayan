/**
 * Birthday Calendar Picker — shared by the resident Profile screen and the
 * account Register screen.
 *
 * A calendar grid instead of free-text date entry — no more malformed dates
 * from manual typing. Styled to match the health screen's DriveCalendar /
 * MonthYearPicker (green-bordered grid, circular day cells, tap-the-month-
 * label-to-jump) rather than either platform's native date dialog, so the
 * picker looks and behaves the same on iOS and Android and never touches
 * react-native's deprecated DateTimePicker `onChange` prop.
 */
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PRIMARY_GREEN = Colors.light.primary; // #0F6E5B — always brand green

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MIN_BIRTH_YEAR = 1900;

/** Zero-pad to 2 digits — used when hand-assembling grid-cell ISO dates. */
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Date → YYYY-MM-DD, using local calendar fields (not toISOString, which is UTC). */
export function dateToIso(date: Date): string {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

/** YYYY-MM-DD → local Date at noon (avoids UTC-midnight rollover across timezones). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function BirthdayCalendarModal({
  visible,
  value,
  onClose,
  onSave,
}: {
  visible: boolean;
  value: Date | null;
  onClose: () => void;
  onSave: (date: Date) => void;
}) {
  const theme = useTheme();
  const today = new Date();
  const todayIso = dateToIso(today);
  const maxYear = today.getFullYear();
  const maxMonthInMaxYear = today.getMonth() + 1; // 1-indexed

  // Default the picker to 25 years ago (a reasonable adult birth year) when
  // no birthday is set yet, rather than opening on the current month.
  const fallback = new Date(maxYear - 25, 0, 1);

  const [viewYear, setViewYear] = useState((value ?? fallback).getFullYear());
  const [viewMonth, setViewMonth] = useState((value ?? fallback).getMonth() + 1);
  const [jumpMode, setJumpMode] = useState(false);

  useEffect(() => {
    if (visible) {
      const d = value ?? fallback;
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth() + 1);
      setJumpMode(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, value]);

  if (!visible) return null;

  const selectedIso = value ? dateToIso(value) : null;

  const canGoNext = !(viewYear === maxYear && viewMonth === maxMonthInMaxYear);
  const canGoPrev = !(viewYear === MIN_BIRTH_YEAR && viewMonth === 1);

  function changeMonth(delta: 1 | -1) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    if (y < MIN_BIRTH_YEAR) return;
    if (y > maxYear || (y === maxYear && m > maxMonthInMaxYear)) return;
    setViewYear(y);
    setViewMonth(m);
  }

  // Build the 42-cell grid (6 rows × 7 cols) — same layout as DriveCalendar.
  const firstWeekday = new Date(viewYear, viewMonth - 1, 1).getDay(); // 0=Sun
  const daysInMonth  = new Date(viewYear, viewMonth, 0).getDate();
  const daysInPrev   = new Date(viewYear, viewMonth - 1, 0).getDate();

  type Cell = { iso: string; day: number; inMonth: boolean };
  const cells: Cell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const pm = viewMonth === 1 ? 12 : viewMonth - 1;
    const py = viewMonth === 1 ? viewYear - 1 : viewYear;
    cells.push({ iso: `${py}-${pad2(pm)}-${pad2(d)}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${viewYear}-${pad2(viewMonth)}-${pad2(d)}`, day: d, inMonth: true });
  }
  const remainder = 42 - cells.length;
  const nm = viewMonth === 12 ? 1 : viewMonth + 1;
  const ny = viewMonth === 12 ? viewYear + 1 : viewYear;
  for (let d = 1; d <= remainder; d++) {
    cells.push({ iso: `${ny}-${pad2(nm)}-${pad2(d)}`, day: d, inMonth: false });
  }
  const rows = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={bcStyles.backdrop} onPress={onClose} />
      <View style={bcStyles.overlay} pointerEvents="box-none">
        <View style={[bcStyles.card, { backgroundColor: theme.background }]}>
          <View style={bcStyles.cardHeader}>
            <ThemedText type="smallBold" style={bcStyles.cardTitle}>Select Birthday</ThemedText>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {jumpMode ? (
            <BirthdayYearMonthGrid
              viewYear={viewYear}
              viewMonth={viewMonth}
              minYear={MIN_BIRTH_YEAR}
              maxYear={maxYear}
              maxMonthInMaxYear={maxMonthInMaxYear}
              onSelect={(y, m) => { setViewYear(y); setViewMonth(m); setJumpMode(false); }}
            />
          ) : (
            <>
              {/* Month header — tap to jump to any year/month */}
              <View style={bcStyles.header}>
                <Pressable
                  style={bcStyles.monthLabel}
                  hitSlop={8}
                  onPress={() => setJumpMode(true)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open year and month picker, currently ${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}>
                  <ThemedText style={{ color: PRIMARY_GREEN, fontSize: 15, fontWeight: '700', lineHeight: 20 }}>
                    {MONTH_NAMES[viewMonth - 1]} {viewYear}
                  </ThemedText>
                  <Ionicons name="chevron-down" size={13} color={PRIMARY_GREEN} />
                </Pressable>
                <View style={bcStyles.navRow}>
                  <Pressable
                    onPress={() => changeMonth(-1)}
                    disabled={!canGoPrev}
                    hitSlop={12}
                    style={[bcStyles.navBtn, !canGoPrev && { opacity: 0.3 }]}>
                    <Ionicons name="chevron-back" size={17} color={theme.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => changeMonth(1)}
                    disabled={!canGoNext}
                    hitSlop={12}
                    style={[bcStyles.navBtn, !canGoNext && { opacity: 0.3 }]}>
                    <Ionicons name="chevron-forward" size={17} color={theme.text} />
                  </Pressable>
                </View>
              </View>

              {/* Day-of-week headers */}
              <View style={bcStyles.dayHeaderRow}>
                {DAY_LABELS.map((l, i) => (
                  <View key={i} style={bcStyles.dayHeaderCell}>
                    <ThemedText style={bcStyles.dayHeaderText}>{l}</ThemedText>
                  </View>
                ))}
              </View>

              {/* Day grid */}
              {rows.map((row, ri) => (
                <View key={ri} style={bcStyles.row}>
                  {row.map((cell, ci) => {
                    const isSelected = cell.iso === selectedIso;
                    const isToday    = cell.iso === todayIso;
                    const isFuture   = cell.iso > todayIso;

                    return (
                      <Pressable
                        key={ci}
                        onPress={() => onSave(isoToLocalDate(cell.iso))}
                        disabled={isFuture}
                        style={bcStyles.cell}
                        hitSlop={2}>
                        <View
                          style={[
                            bcStyles.circle,
                            isSelected && { backgroundColor: PRIMARY_GREEN },
                            isToday && !isSelected && { borderWidth: 2, borderColor: PRIMARY_GREEN },
                          ]}>
                          <ThemedText
                            style={[
                              bcStyles.dayNum,
                              !cell.inMonth && { color: theme.textSecondary, opacity: 0.4 },
                              isFuture && { color: theme.textSecondary, opacity: 0.3 },
                              isSelected && { color: '#ffffff' },
                              isToday && !isSelected && { color: PRIMARY_GREEN },
                            ]}>
                            {cell.day}
                          </ThemedText>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const YEAR_CHIP_WIDTH = 68; // width + gap, kept in sync with bymStyles.yearChip

/** Year (scrollable list, 1900…current) + 4×3 month grid — jumps `viewYear`/`viewMonth` far in one tap. */
function BirthdayYearMonthGrid({
  viewYear,
  viewMonth,
  minYear,
  maxYear,
  maxMonthInMaxYear,
  onSelect,
}: {
  viewYear: number;
  viewMonth: number;
  minYear: number;
  maxYear: number;
  maxMonthInMaxYear: number;
  onSelect: (year: number, month: number) => void;
}) {
  const [pickerYear, setPickerYear] = useState(viewYear);
  const listRef = useRef<ScrollView>(null);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  useEffect(() => {
    const idx = years.indexOf(viewYear);
    if (idx >= 0) {
      // Center the current year in the visible strip.
      const x = Math.max(0, idx * YEAR_CHIP_WIDTH - YEAR_CHIP_WIDTH * 2);
      requestAnimationFrame(() => listRef.current?.scrollTo({ x, animated: false }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View>
      <ScrollView
        ref={listRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={bymStyles.yearRow}>
        {years.map((y) => {
          const isSelected = y === pickerYear;
          return (
            <Pressable
              key={y}
              onPress={() => setPickerYear(y)}
              style={[bymStyles.yearChip, isSelected && { backgroundColor: PRIMARY_GREEN }]}>
              <ThemedText style={[bymStyles.yearChipText, isSelected && { color: '#ffffff', fontWeight: '700' }]}>
                {y}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={bymStyles.divider} />

      <View style={bymStyles.monthGrid}>
        {MONTH_ABBR.map((abbr, idx) => {
          const m = idx + 1;
          const disabled = pickerYear === maxYear && m > maxMonthInMaxYear;
          const isSelected = pickerYear === viewYear && m === viewMonth;

          return (
            <Pressable
              key={m}
              disabled={disabled}
              onPress={() => onSelect(pickerYear, m)}
              style={[
                bymStyles.monthCell,
                isSelected && { backgroundColor: PRIMARY_GREEN },
                disabled && { opacity: 0.3 },
              ]}>
              <ThemedText
                type="small"
                style={[
                  bymStyles.monthCellText,
                  isSelected && { color: '#ffffff', fontWeight: '700' },
                ]}>
                {abbr}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const bcStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    padding: Spacing.three,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.two,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    marginBottom: 2,
  },
  monthLabel: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  navRow: { flexDirection: 'row', gap: Spacing.one },
  navBtn: { padding: 3 },
  dayHeaderRow: { flexDirection: 'row', marginBottom: 1 },
  dayHeaderCell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  dayHeaderText: { fontWeight: '700', fontSize: 13, color: PRIMARY_GREEN, lineHeight: 17 },
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', paddingVertical: 2 },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayNum: { fontSize: 15, fontWeight: '700', lineHeight: 19 },
});

const bymStyles = StyleSheet.create({
  yearRow: { gap: Spacing.two, paddingHorizontal: Spacing.one, paddingBottom: Spacing.one },
  yearChip: {
    minWidth: 56,
    alignItems: 'center',
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: 10,
    backgroundColor: '#F0F0F3',
  },
  yearChipText: { fontSize: 14, fontWeight: '600', color: '#60646C' },
  divider: { height: 1, backgroundColor: '#E8E8EC', marginVertical: Spacing.three },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  monthCell: {
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: 10,
    backgroundColor: '#F0F0F3',
  },
  monthCellText: { fontWeight: '500', color: '#60646C' },
});
