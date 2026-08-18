/**
 * Health & Medical Drive screen — Module 10.
 *
 * Active Medical Drives segment:
 *   Calendar (with per-type color dots)
 *   →  "All Medical Drives for [Month]" toggle filter
 *   →  Horizontal scrollable category filter (with edge chevrons)
 *   →  date header card  →  drive cards  →  /health/register (full-screen)
 *
 * My Registrations segment:
 *   List of drive_registrations joined with medical_drives, grouped by status.
 *
 * Design tokens sampled from the reference screenshot:
 *   Primary green  #0F6E5B  (=Colors.light.primary, matches theme.primary)
 *   Progress green #22C55E  (healthier, distinct from brand primary)
 *   Calendar border 1.5 px green, 16 px radius
 *   Date-header card: 1.5 px green border, 12 px radius, bold green text
 *   Drive card: white bg, 16 px radius, iOS shadow / Android elevation 3
 */
import { DRIVE_TYPES, DRIVE_TYPE_CONFIG as SHARED_DRIVE_TYPE_CONFIG } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { type DriveRegistration, type DriveType, type MedicalDrive, useMedicalDrives } from '@/hooks/use-medical-drives';
import { useTheme } from '@/hooks/use-theme';

// ─── Constants ───────────────────────────────────────────────────────────────

// #0F6E5B brand-green fallback — only used for module-level config defaults below
// (DRIVE_TYPE_CONFIG.all, REG_STATUS_CONFIG.all/confirmed, STATUS_CYCLE's confirmed step),
// which are built once at import time and can't read the per-account accent color.
// Every component below shadows this with `const PRIMARY_GREEN = theme.primary;` right
// after its useTheme() call, so the resident's chosen accent (Settings > App Theme)
// actually shows up here — see the shadow comment at each component for the "why".
const PRIMARY_GREEN_FALLBACK = Colors.light.primary;
const PRIMARY_GREEN = PRIMARY_GREEN_FALLBACK;
const PROGRESS_GREEN = '#22C55E';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type DriveTypeFilter = DriveType | 'all';

/**
 * Visual config for every drive type (color, label) — sourced from
 * @barangayan/shared's DRIVE_TYPE_CONFIG (the single source of truth also used by the
 * admin web Health screen), plus the 'all' pseudo-type this screen's filter chips add.
 */
const DRIVE_TYPE_CONFIG: Record<DriveTypeFilter, { label: string; color: string }> = {
  // Fallback only — HorizontalCategoryNav overrides this with the live accent color
  // (theme.primary) at render time since this object is built once at import.
  all: { label: 'All', color: PRIMARY_GREEN_FALLBACK },
  ...SHARED_DRIVE_TYPE_CONFIG,
};

/**
 * Flat ordered list of all filter keys for the horizontal category nav.
 * 'all' leads, followed by every drive type in canonical order.
 */
const ALL_FILTER_KEYS: DriveTypeFilter[] = ['all', ...DRIVE_TYPES];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "2026-08-08" → Date at local noon (avoids UTC-midnight timezone shifts). */
function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/** Zero-pad to 2 digits. */
const pad2 = (n: number) => String(n).padStart(2, '0');

/** Today as YYYY-MM-DD in local time. */
function localToday(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

/** "HH:MM:SS" → "8:00 AM" */
function fmt12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  const h = parseInt(hStr, 10);
  const m = mStr ?? '00';
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${period}`;
}

/** "2026-08-08" → "Aug 8" */
function fmtShortDate(iso: string): string {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/** "2026-08-08" → "Saturday, August 8" */
function fmtFullDate(iso: string): string {
  const d = parseLocalDate(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ─── MonthYearPicker ──────────────────────────────────────────────────────────

/** Short 3-letter abbreviations shown in the picker grid. */
const MONTH_ABBR = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/**
 * Centered dialog that lets the user pick any month + year and jump to it.
 * Year range: current year − 1 to current year + 5 (navigable with arrows).
 */
function MonthYearPicker({
  visible,
  initialYear,
  initialMonth,
  todayYear,
  todayMonth,
  onSelect,
  onClose,
}: {
  visible: boolean;
  initialYear: number;
  initialMonth: number;   // 1-indexed
  todayYear: number;
  todayMonth: number;     // 1-indexed
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback with the resident's live accent color (Settings >
  // App Theme) — theme.primary already resolves to it (see use-theme.ts).
  const PRIMARY_GREEN = theme.primary;

  // Local year browsed inside the picker (separate from the calendar's currentMonth)
  const [pickerYear, setPickerYear] = useState(initialYear);

  // Reset picker year whenever the dialog reopens
  useEffect(() => {
    if (visible) setPickerYear(initialYear);
  }, [visible, initialYear]);

  const MIN_YEAR = todayYear - 1;
  const MAX_YEAR = todayYear + 5;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <Pressable style={mpStyles.backdrop} onPress={onClose} />

      {/* Centered card */}
      <View style={mpStyles.overlay} pointerEvents="box-none">
        <View style={[mpStyles.card, { backgroundColor: theme.background }]}>
          {/* Header */}
          <View style={mpStyles.cardHeader}>
            <ThemedText type="smallBold" style={mpStyles.cardTitle}>
              Select Month &amp; Year
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>

          {/* Year navigation row */}
          <View style={mpStyles.yearRow}>
            <Pressable
              onPress={() => setPickerYear((y) => Math.max(y - 1, MIN_YEAR))}
              disabled={pickerYear <= MIN_YEAR}
              hitSlop={12}
              style={[
                mpStyles.yearNavBtn,
                pickerYear <= MIN_YEAR && { opacity: 0.3 },
              ]}>
              <Ionicons name="chevron-back" size={20} color={PRIMARY_GREEN} />
            </Pressable>

            <ThemedText style={[mpStyles.yearText, { color: PRIMARY_GREEN }]}>{pickerYear}</ThemedText>

            <Pressable
              onPress={() => setPickerYear((y) => Math.min(y + 1, MAX_YEAR))}
              disabled={pickerYear >= MAX_YEAR}
              hitSlop={12}
              style={[
                mpStyles.yearNavBtn,
                pickerYear >= MAX_YEAR && { opacity: 0.3 },
              ]}>
              <Ionicons name="chevron-forward" size={20} color={PRIMARY_GREEN} />
            </Pressable>
          </View>

          {/* Divider */}
          <View style={[mpStyles.divider, { backgroundColor: theme.backgroundSelected }]} />

          {/* 4 × 3 month grid */}
          <View style={mpStyles.monthGrid}>
            {MONTH_ABBR.map((abbr, idx) => {
              const m = idx + 1; // 1-indexed
              const isSelected = pickerYear === initialYear && m === initialMonth;
              const isToday    = pickerYear === todayYear   && m === todayMonth;

              return (
                <Pressable
                  key={m}
                  onPress={() => { onSelect(pickerYear, m); onClose(); }}
                  style={[
                    mpStyles.monthCell,
                    isSelected && { backgroundColor: PRIMARY_GREEN },
                    isToday && !isSelected && {
                      borderWidth: 1.5,
                      borderColor: PRIMARY_GREEN,
                    },
                  ]}>
                  <ThemedText
                    type="small"
                    style={[
                      mpStyles.monthCellText,
                      isSelected && { color: '#ffffff', fontWeight: '700' },
                      isToday && !isSelected && { color: PRIMARY_GREEN, fontWeight: '700' },
                    ]}>
                    {abbr}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const mpStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  card: {
    width: '100%',
    maxWidth: 340,
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
    marginBottom: Spacing.three,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.two,
  },
  yearNavBtn: {
    padding: Spacing.two,
    borderRadius: 8,
  },
  yearText: {
    fontSize: 22,
    fontWeight: '700',
    // color applied inline at the usage site with the live accent — see PRIMARY_GREEN
    // shadowing comment in MonthYearPicker above.
  },
  divider: {
    height: 1,
    marginBottom: Spacing.three,
  },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  monthCell: {
    // 4 per row: (100% − 3 gaps) / 4; using percentage-ish via flex basis
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: 10,
  },
  monthCellText: {
    fontWeight: '500',
  },
});

// ─── DriveCalendar ───────────────────────────────────────────────────────────

/**
 * Calendar widget with per-type color dots under each day number.
 *
 * `eventDateMap` maps YYYY-MM-DD → array of up to 3 hex colors, one per
 * distinct drive type scheduled on that date.  The calendar renders a row of
 * colored dots so users can identify drive categories at a glance.
 */
function DriveCalendar({
  selectedDate,
  onDateSelect,
  eventDateMap,
  currentMonth,      // { year, month } where month is 1-indexed
  onMonthChange,
  onJumpTo,
}: {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  eventDateMap: Record<string, string[]>;
  currentMonth: { year: number; month: number };
  onMonthChange: (delta: 1 | -1) => void;
  onJumpTo: (year: number, month: number) => void;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;
  const today = localToday();
  const { year, month } = currentMonth;

  // Month/year picker visibility
  const [pickerVisible, setPickerVisible] = useState(false);

  // Today's year + month for "current month" ring in the picker grid
  const todayDate  = new Date();
  const todayYear  = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth() + 1; // 1-indexed

  // Build the 42-cell grid (6 rows × 7 cols)
  const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth  = new Date(year, month, 0).getDate();
  const daysInPrev   = new Date(year, month - 1, 0).getDate();

  type Cell = { date: string; day: number; inMonth: boolean };
  const cells: Cell[] = [];

  // Trailing days from previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    cells.push({ date: `${py}-${pad2(pm)}-${pad2(d)}`, day: d, inMonth: false });
  }

  // Current month
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad2(month)}-${pad2(d)}`, day: d, inMonth: true });
  }

  // Leading days from next month
  const remainder = 42 - cells.length;
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  for (let d = 1; d <= remainder; d++) {
    cells.push({ date: `${ny}-${pad2(nm)}-${pad2(d)}`, day: d, inMonth: false });
  }

  const rows = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <View style={[calStyles.container, { borderColor: PRIMARY_GREEN }]}>
      {/* Month/year picker dialog */}
      <MonthYearPicker
        visible={pickerVisible}
        initialYear={year}
        initialMonth={month}
        todayYear={todayYear}
        todayMonth={todayMonth}
        onSelect={(y, m) => { onJumpTo(y, m); setPickerVisible(false); }}
        onClose={() => setPickerVisible(false)}
      />

      {/* Month header */}
      <View style={calStyles.header}>
        <Pressable
          style={calStyles.monthLabel}
          hitSlop={8}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Open month and year picker, currently ${MONTH_NAMES[month - 1]} ${year}`}>
          <ThemedText style={{ color: PRIMARY_GREEN, fontSize: 15, fontWeight: '700', lineHeight: 20 }}>
            {MONTH_NAMES[month - 1]} {year}
          </ThemedText>
          <Ionicons
            name={pickerVisible ? 'chevron-up' : 'chevron-down'}
            size={13}
            color={PRIMARY_GREEN}
          />
        </Pressable>
        <View style={calStyles.navRow}>
          <Pressable onPress={() => onMonthChange(-1)} hitSlop={12} style={calStyles.navBtn}>
            <Ionicons name="chevron-back" size={17} color={theme.text} />
          </Pressable>
          <Pressable onPress={() => onMonthChange(1)} hitSlop={12} style={calStyles.navBtn}>
            <Ionicons name="chevron-forward" size={17} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Day-of-week headers */}
      <View style={calStyles.dayHeaderRow}>
        {DAY_LABELS.map((l, i) => (
          <View key={i} style={calStyles.dayHeaderCell}>
            <ThemedText style={[calStyles.dayHeaderText, { color: PRIMARY_GREEN }]}>{l}</ThemedText>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={calStyles.row}>
          {row.map((cell, ci) => {
            const isSelected  = cell.date === selectedDate;
            const isToday     = cell.date === today;
            const eventColors = eventDateMap[cell.date] ?? [];
            const hasEvent    = eventColors.length > 0;

            return (
              <Pressable
                key={ci}
                onPress={() => onDateSelect(cell.date)}
                style={calStyles.cell}
                hitSlop={2}>
                <View
                  style={[
                    calStyles.circle,
                    isSelected && { backgroundColor: PRIMARY_GREEN },
                    isToday && !isSelected && { borderWidth: 2, borderColor: PRIMARY_GREEN },
                  ]}>
                  <ThemedText
                    style={[
                      calStyles.dayNum,
                      !cell.inMonth && { color: theme.textSecondary, opacity: 0.4 },
                      isSelected && { color: '#ffffff' },
                      isToday && !isSelected && { color: PRIMARY_GREEN },
                    ]}>
                    {cell.day}
                  </ThemedText>

                  {/* Event accent — thin colored bar(s) at bottom of circle */}
                  {hasEvent && (
                    <View style={calStyles.accentRow}>
                      {eventColors.slice(0, 3).map((color, idx) => (
                        <View
                          key={idx}
                          style={[
                            calStyles.accentBar,
                            { backgroundColor: isSelected ? 'rgba(255,255,255,0.75)' : color },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const calStyles = StyleSheet.create({
  container: {
    borderWidth: 1.5,
    borderRadius: 14,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    paddingHorizontal: Spacing.two,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    marginBottom: 2,
  },
  monthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  navBtn: {
    padding: 3,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 1,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  dayHeaderText: {
    fontWeight: '700',
    fontSize: 13,
    // color applied inline at the usage site with the live accent.
    lineHeight: 17,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 2,
  },
  // Circle is tighter; event accents live inside it at the bottom
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  dayNum: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 19,
  },
  // Thin colored accent bars pinned to the bottom edge of the circle
  accentRow: {
    position: 'absolute',
    bottom: 3,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accentBar: {
    width: 5,
    height: 3,
    borderRadius: 1.5,
  },
});

// ─── Horizontal Category Navigation ──────────────────────────────────────────

/**
 * A single horizontally-scrollable row of category filter chips.
 * Chevron buttons on the left/right edges signal scrollability and
 * allow tap-to-scroll for accessibility.  Chevrons fade when the list
 * is already scrolled to that edge.
 */
function HorizontalCategoryNav({
  active,
  onSelect,
}: {
  active: DriveTypeFilter;
  onSelect: (k: DriveTypeFilter) => void;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;
  const scrollRef = useRef<ScrollView>(null);

  const [canScrollLeft,  setCanScrollLeft]  = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Track scroll position + dimensions via refs (no re-render needed)
  const scrollXRef       = useRef(0);
  const contentWidthRef  = useRef(0);
  const viewWidthRef     = useRef(0);

  const handleScroll = (e: {
    nativeEvent: {
      contentOffset: { x: number };
      contentSize: { width: number };
      layoutMeasurement: { width: number };
    };
  }) => {
    const x   = e.nativeEvent.contentOffset.x;
    const max = e.nativeEvent.contentSize.width - e.nativeEvent.layoutMeasurement.width;
    scrollXRef.current = x;
    setCanScrollLeft(x > 5);
    setCanScrollRight(x < max - 5);
  };

  /** Tap a chevron to scroll the list by ~120 px in that direction. */
  const scrollBy = (dir: 'left' | 'right') => {
    const step = 120;
    const newX =
      dir === 'left'
        ? Math.max(0, scrollXRef.current - step)
        : Math.min(
            contentWidthRef.current - viewWidthRef.current,
            scrollXRef.current + step,
          );
    scrollRef.current?.scrollTo({ x: newX, animated: true });
  };

  return (
    <View style={hcnStyles.wrapper}>
      {/* Left edge chevron */}
      <Pressable
        onPress={() => scrollBy('left')}
        hitSlop={8}
        accessibilityLabel="Scroll categories left"
        style={[hcnStyles.chevron, { backgroundColor: PRIMARY_GREEN + '18' }, !canScrollLeft && hcnStyles.chevronFaded]}>
        <Ionicons name="chevron-back" size={18} color={PRIMARY_GREEN} />
      </Pressable>

      {/* Scrollable chip row */}
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        onContentSizeChange={(w) => { contentWidthRef.current = w; }}
        onLayout={(e) => { viewWidthRef.current = e.nativeEvent.layout.width; }}
        contentContainerStyle={hcnStyles.scrollContent}>
        {ALL_FILTER_KEYS.map((key) => {
          const { label } = DRIVE_TYPE_CONFIG[key];
          // 'all' is brand-colored (live accent), not the fixed drive-type palette.
          const color = key === 'all' ? PRIMARY_GREEN : DRIVE_TYPE_CONFIG[key].color;
          const isActive = active === key;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              style={[
                hcnStyles.chip,
                isActive
                  ? { backgroundColor: color }
                  : { borderWidth: 1.5, borderColor: color },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}>
              {/* Color dot for inactive non-"all" chips */}
              {key !== 'all' && !isActive && (
                <View style={[hcnStyles.dot, { backgroundColor: color }]} />
              )}
              <ThemedText
                type="small"
                style={[hcnStyles.chipLabel, { color: isActive ? '#ffffff' : color }]}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Right edge chevron */}
      <Pressable
        onPress={() => scrollBy('right')}
        hitSlop={8}
        accessibilityLabel="Scroll categories right"
        style={[hcnStyles.chevron, { backgroundColor: PRIMARY_GREEN + '18' }, !canScrollRight && hcnStyles.chevronFaded]}>
        <Ionicons name="chevron-forward" size={18} color={PRIMARY_GREEN} />
      </Pressable>
    </View>
  );
}

const hcnStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: Spacing.one,
  },
  chevron: {
    padding: 6,
    borderRadius: 16,
    // backgroundColor applied inline at each usage site with the live accent.
  },
  chevronFaded: {
    opacity: 0.3,
  },
  scrollContent: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  chipLabel: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
});

// ─── Drive Card ───────────────────────────────────────────────────────────────

function DriveCard({
  drive,
  isRegistered,
  onRegister,
}: {
  drive: MedicalDrive;
  isRegistered: boolean;
  onRegister: () => void;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;
  const cfg = DRIVE_TYPE_CONFIG[drive.type] ?? DRIVE_TYPE_CONFIG.others;
  const fraction = drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0;

  return (
    <View style={[dCardStyles.card, { backgroundColor: theme.background }]}>

      {/* ── Row 1: title + type badge ─────────────────────────────────── */}
      <View style={dCardStyles.titleRow}>
        <ThemedText style={dCardStyles.title} numberOfLines={2}>
          {drive.title}
        </ThemedText>
        <View style={[dCardStyles.badge, { backgroundColor: cfg.color + '22' }]}>
          <ThemedText style={[dCardStyles.badgeText, { color: cfg.color }]}>
            {cfg.label}
          </ThemedText>
        </View>
      </View>

      {/* ── Row 2: date · time · location (icon-prefixed, one line) ──── */}
      <View style={dCardStyles.metaRow}>
        <Ionicons name="calendar-outline" size={13} color={PRIMARY_GREEN} style={dCardStyles.metaIcon} />
        <ThemedText themeColor="textSecondary" style={dCardStyles.metaText} numberOfLines={1}>
          {fmtShortDate(drive.drive_date)}
          {'  ·  '}
          {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
        </ThemedText>
        <View style={[dCardStyles.metaDot, { backgroundColor: PRIMARY_GREEN + '55' }]} />
        <Ionicons name="location-outline" size={13} color={PRIMARY_GREEN} style={dCardStyles.metaIcon} />
        <ThemedText themeColor="textSecondary" style={dCardStyles.metaText} numberOfLines={1}>
          {drive.location}
        </ThemedText>
      </View>

      {/* ── Row 3: eligibility (icon-prefixed) ───────────────────────── */}
      <View style={dCardStyles.metaRow}>
        <Ionicons name="person-outline" size={13} color={PRIMARY_GREEN} style={dCardStyles.metaIcon} />
        <ThemedText themeColor="textSecondary" style={dCardStyles.metaText} numberOfLines={1}>
          {drive.eligible_criteria}
        </ThemedText>
      </View>

      {/* ── Row 4: stock label + count + action (all one row) ─────────── */}
      <View style={dCardStyles.stockRow}>
        <View style={dCardStyles.stockLeft}>
          <ThemedText style={dCardStyles.stockLabel}>{drive.stock_label}</ThemedText>
          <ThemedText style={dCardStyles.stockCount}>
            <ThemedText style={dCardStyles.stockRemaining}>{drive.stock_remaining}</ThemedText>
            {'/'}{drive.stock_total} {drive.stock_unit}
          </ThemedText>
        </View>

        {/* Action button pushed to the right */}
        {isRegistered ? (
          <View style={[dCardStyles.registeredPill, { backgroundColor: PRIMARY_GREEN + '18' }]}>
            <Ionicons name="checkmark-circle" size={13} color={PRIMARY_GREEN} />
            <ThemedText style={[dCardStyles.actionText, { color: PRIMARY_GREEN }]}>
              Registered
            </ThemedText>
          </View>
        ) : (
          <Pressable
            onPress={onRegister}
            disabled={drive.stock_remaining === 0}
            style={[
              dCardStyles.registerBtn,
              {
                backgroundColor:
                  drive.stock_remaining === 0 ? theme.backgroundSelected : PRIMARY_GREEN,
              },
            ]}>
            <ThemedText
              style={[
                dCardStyles.actionText,
                { color: drive.stock_remaining === 0 ? theme.textSecondary : '#ffffff' },
              ]}>
              {drive.stock_remaining === 0 ? 'Full' : 'Register'}
            </ThemedText>
          </Pressable>
        )}
      </View>

      {/* ── Progress bar (slim, no extra margin row) ──────────────────── */}
      <ProgressBar fraction={fraction} color={PROGRESS_GREEN} />
    </View>
  );
}

const dCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 5,
    elevation: 2,
  },
  // Row 1 — title + badge
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  badge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'center',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  // Rows 2 & 3 — icon-prefixed meta lines
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaIcon: {
    flexShrink: 0,
  },
  metaText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
    flexShrink: 1,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    // backgroundColor applied inline at the usage site with the live accent.
    marginHorizontal: 2,
    flexShrink: 0,
  },
  // Row 4 — stock + action
  stockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: 2,
  },
  stockLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 5,
    flex: 1,
    flexWrap: 'wrap',
  },
  stockLabel: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  stockCount: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
    opacity: 0.75,
  },
  stockRemaining: {
    fontWeight: '700',
    fontSize: 13,
  },
  // Shared action text (Register / Registered / Full)
  actionText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  registerBtn: {
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    flexShrink: 0,
  },
  registeredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
});

// ─── Registration Modal ───────────────────────────────────────────────────────

function RegistrationModal({
  drive,
  visible,
  onClose,
  onConfirm,
}: {
  drive: MedicalDrive | null;
  visible: boolean;
  onClose: () => void;
  onConfirm: (params: {
    driveId: string;
    age: number;
    isPwd: boolean;
    comorbidities: string[];
    priorDoseDate?: string | null;
  }) => Promise<{ applicant_number: string; priority_score: number }>;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;

  const [age, setAge] = useState('');
  const [isPwd, setIsPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ applicant_number: string; priority_score: number } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Slide in / out animation
  useEffect(() => {
    if (visible) {
      setAge('');
      setIsPwd(false);
      setFormError(null);
      setResult(null);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 180,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 220,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const cfg = drive ? DRIVE_TYPE_CONFIG[drive.type] ?? DRIVE_TYPE_CONFIG.others : null;

  const handleSubmit = async () => {
    Keyboard.dismiss();
    const ageNum = parseInt(age.trim(), 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 0 || ageNum > 130) {
      setFormError('Please enter a valid age (0–130).');
      return;
    }
    if (!drive) return;
    setFormError(null);
    setSubmitting(true);
    try {
      const res = await onConfirm({
        driveId: drive.id,
        age: ageNum,
        isPwd,
        comorbidities: [],
      });
      setResult(res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed. Please try again.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  if (!drive) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <Pressable style={modalStyles.backdrop} onPress={onClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={modalStyles.kav}
        pointerEvents="box-none">
        <Animated.View
          style={[
            modalStyles.sheet,
            { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.three },
            { transform: [{ translateY: slideAnim }] },
          ]}>
          {/* Drag handle */}
          <View style={[modalStyles.handle, { backgroundColor: theme.backgroundSelected }]} />

          {/* Drive heading */}
          <View style={modalStyles.driveHeader}>
            <ThemedText style={modalStyles.driveTitle}>{drive.title}</ThemedText>
            {cfg && (
              <View style={[modalStyles.driveBadge, { backgroundColor: cfg.color + '26' }]}>
                <ThemedText style={[modalStyles.driveBadgeText, { color: cfg.color }]}>
                  {cfg.label}
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={{ marginBottom: Spacing.three }}>
            {fmtShortDate(drive.drive_date)} · {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
            {'  ·  '}{drive.location}
          </ThemedText>

          {result ? (
            /* ── Success state ─────────────────────────────────────────────── */
            <View style={modalStyles.successBox}>
              <Ionicons name="checkmark-circle" size={48} color={PRIMARY_GREEN} />
              <ThemedText type="smallBold" style={[modalStyles.successTitle, { color: PRIMARY_GREEN }]}>
                Registration Confirmed!
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Your applicant number is:
              </ThemedText>
              <View style={[modalStyles.appNumBox, { borderColor: PRIMARY_GREEN }]}>
                <ThemedText style={[modalStyles.appNum, { color: PRIMARY_GREEN }]}>
                  {result.applicant_number}
                </ThemedText>
              </View>
              <ThemedText type="small" themeColor="textSecondary" style={{ textAlign: 'center' }}>
                Priority score: {result.priority_score} pts · Please arrive on time.
              </ThemedText>
              <Pressable
                onPress={onClose}
                style={[modalStyles.submitBtn, { backgroundColor: PRIMARY_GREEN, marginTop: Spacing.three }]}>
                <ThemedText type="smallBold" style={{ color: '#fff' }}>Done</ThemedText>
              </Pressable>
            </View>
          ) : (
            /* ── Form state ────────────────────────────────────────────────── */
            <>
              <ThemedText type="smallBold" style={modalStyles.sectionLabel}>
                Your Age
              </ThemedText>
              <View style={[modalStyles.inputWrap, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
                <TextInput
                  style={[modalStyles.input, { color: theme.text }]}
                  placeholder="Enter your age"
                  placeholderTextColor={theme.textSecondary}
                  keyboardType="number-pad"
                  value={age}
                  onChangeText={setAge}
                  maxLength={3}
                  returnKeyType="done"
                />
              </View>

              <View style={modalStyles.pwdRow}>
                <View>
                  <ThemedText type="smallBold">Person with Disability (PWD)</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    +30 priority points
                  </ThemedText>
                </View>
                <Switch
                  value={isPwd}
                  onValueChange={setIsPwd}
                  trackColor={{ false: theme.backgroundSelected, true: PRIMARY_GREEN + '60' }}
                  thumbColor={isPwd ? PRIMARY_GREEN : theme.textSecondary}
                />
              </View>

              {formError && (
                <View style={modalStyles.errorBox}>
                  <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                  <ThemedText type="small" style={{ color: '#EF4444', flex: 1 }}>
                    {formError}
                  </ThemedText>
                </View>
              )}

              <Pressable
                onPress={handleSubmit}
                disabled={submitting}
                style={[
                  modalStyles.submitBtn,
                  { backgroundColor: submitting ? PRIMARY_GREEN + '80' : PRIMARY_GREEN },
                ]}>
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText type="smallBold" style={{ color: '#fff' }}>
                    Confirm Registration
                  </ThemedText>
                )}
              </Pressable>
            </>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const modalStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  kav: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.two,
  },
  driveHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginBottom: Spacing.half,
  },
  driveTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  driveBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  driveBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionLabel: {
    marginBottom: -Spacing.half,
  },
  inputWrap: {
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  input: {
    fontSize: 16,
    lineHeight: 22,
  },
  pwdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.half,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: Spacing.two,
  },
  submitBtn: {
    borderRadius: 24,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  successBox: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  successTitle: {
    fontSize: 18,
    // color applied inline at the usage site with the live accent.
  },
  appNumBox: {
    borderWidth: 2,
    borderRadius: 10,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  appNum: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
});

// ─── Registration Status Filter ───────────────────────────────────────────────

type RegStatusFilter = 'all' | 'pending' | 'confirmed' | 'attended' | 'cancelled';

// 'all'/'confirmed' colors here are fallbacks only — RegStatusFilterBar overrides them
// with the live accent color at render time since this object is built once at import.
const REG_STATUS_CONFIG: Record<RegStatusFilter, { label: string; color: string }> = {
  all:       { label: 'All',       color: PRIMARY_GREEN_FALLBACK },
  pending:   { label: 'Pending',   color: '#F59E0B' },
  confirmed: { label: 'Confirmed', color: PRIMARY_GREEN_FALLBACK },
  attended:  { label: 'Attended',  color: '#6366F1' },
  cancelled: { label: 'Cancelled', color: '#EF4444' },
};

const REG_STATUS_KEYS: RegStatusFilter[] = ['all', 'pending', 'confirmed', 'attended', 'cancelled'];

/**
 * Horizontally-scrollable status filter chips — same design as HorizontalCategoryNav
 * in the Active Medical Drives segment.
 */
function RegStatusFilterBar({
  active,
  onSelect,
}: {
  active: RegStatusFilter;
  onSelect: (k: RegStatusFilter) => void;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;

  return (
    <View style={hcnStyles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={hcnStyles.scrollContent}>
        {REG_STATUS_KEYS.map((key) => {
          const { label } = REG_STATUS_CONFIG[key];
          // 'all'/'confirmed' are brand-colored (live accent), not the fixed status palette.
          const color = key === 'all' || key === 'confirmed' ? PRIMARY_GREEN : REG_STATUS_CONFIG[key].color;
          const isActive = active === key;
          return (
            <Pressable
              key={key}
              onPress={() => onSelect(key)}
              style={[
                hcnStyles.chip,
                isActive
                  ? { backgroundColor: color }
                  : { borderWidth: 1.5, borderColor: color },
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}>
              <ThemedText
                type="small"
                style={[hcnStyles.chipLabel, { color: isActive ? '#ffffff' : color }]}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ─── Registration Detail Bottom Sheet ────────────────────────────────────────

/**
 * Status cycle definition — the four ordered lifecycle states a registration
 * moves through.  Each step carries its colour, a short label, and a one-liner
 * description used in the status-timeline inside the detail sheet.
 */
const STATUS_CYCLE: {
  key: string;
  label: string;
  color: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  description: string;
}[] = [
  {
    key: 'pending',
    label: 'Pending',
    color: '#F59E0B',
    icon: 'time-outline',
    description: 'Your application has been received and is awaiting barangay review.',
  },
  {
    // Fallback only — RegistrationDetailSheet overrides this with the live accent color
    // at render time since this array is built once at import.
    key: 'confirmed',
    label: 'Confirmed',
    color: PRIMARY_GREEN_FALLBACK,
    icon: 'checkmark-circle-outline',
    description: 'Your slot is confirmed. Please arrive on time on the drive date.',
  },
  {
    key: 'attended',
    label: 'Attended',
    color: '#6366F1',
    icon: 'ribbon-outline',
    description: 'You have successfully attended this medical drive. Thank you!',
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    color: '#EF4444',
    icon: 'close-circle-outline',
    description: 'This registration has been cancelled.',
  },
];

/**
 * Full-detail bottom sheet for a single DriveRegistration.
 *
 * Layout (top → bottom inside the sheet):
 *   • Drag handle
 *   • Drive title + type badge header
 *   • ── Registration Info ── (applicant #, priority score, registered-on date)
 *   • ── Drive Details ──     (date, time, location, eligibility, stock)
 *   • ── Status Timeline ──   (vertical stepper showing the full cycle)
 *   • Close button
 */
function RegistrationDetailSheet({
  registration,
  visible,
  onClose,
}: {
  registration: DriveRegistration | null;
  visible: boolean;
  onClose: () => void;
}) {
  const theme   = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;
  const insets  = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(700)).current;

  useEffect(() => {
    if (visible) {
      // Reset to off-screen first so every open animates from the bottom,
      // regardless of where the previous close animation left the value.
      slideAnim.setValue(700);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 24,
        stiffness: 200,
      }).start();
    } else {
      // Reset to fully visible first so every close animates from the resting
      // position, regardless of where a previous animation left the value.
      slideAnim.setValue(0);
      Animated.timing(slideAnim, {
        toValue: 700,
        duration: 230,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  if (!registration) return null;

  const drive = registration.drive;
  const cfg   = drive ? DRIVE_TYPE_CONFIG[drive.type] ?? DRIVE_TYPE_CONFIG.others : null;

  // Which step in the cycle is current?
  const currentStepIdx = STATUS_CYCLE.findIndex((s) => s.key === registration.status);
  // If cancelled, only show steps up-to-and-including cancelled (remove attended)
  const isCancelled = registration.status === 'cancelled';
  const visibleSteps = isCancelled
    ? STATUS_CYCLE.filter((s) => s.key !== 'attended')
    : STATUS_CYCLE.filter((s) => s.key !== 'cancelled');

  const currentVisibleIdx = visibleSteps.findIndex((s) => s.key === registration.status);

  // Formatted registered-on date
  const registeredOn = registration.created_at
    ? new Date(registration.created_at).toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

  const stock_fraction =
    drive && drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent>

      {/* Backdrop */}
      <Pressable style={rdStyles.backdrop} onPress={onClose} />

      {/* Animated sheet */}
      <Animated.View
        style={[
          rdStyles.sheet,
          {
            backgroundColor: theme.background,
            paddingBottom: insets.bottom + Spacing.three,
            transform: [{ translateY: slideAnim }],
          },
        ]}>

        {/* ── Drag handle ──────────────────────────────────────────────── */}
        <View style={[rdStyles.handle, { backgroundColor: theme.backgroundSelected }]} />

        {/* ── Scrollable content ───────────────────────────────────────── */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={rdStyles.scrollContent}
          bounces={false}>

          {/* ══ Header: title + type badge ══════════════════════════════ */}
          <View style={rdStyles.headerRow}>
            <View style={{ flex: 1 }}>
              <ThemedText style={rdStyles.driveTitle} numberOfLines={3}>
                {drive?.title ?? 'Medical Drive'}
              </ThemedText>
            </View>
            {cfg && (
              <View style={[rdStyles.typeBadge, { backgroundColor: cfg.color + '22' }]}>
                <ThemedText style={[rdStyles.typeBadgeText, { color: cfg.color }]}>
                  {cfg.label}
                </ThemedText>
              </View>
            )}
          </View>

          {/* ══ Section: Registration Info ══════════════════════════════ */}
          <View style={rdStyles.section}>
            <View style={rdStyles.sectionHeader}>
              <View style={[rdStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
              <ThemedText style={[rdStyles.sectionTitle, { color: PRIMARY_GREEN }]}>
                Registration Info
              </ThemedText>
            </View>

            <View style={[rdStyles.infoCard, { backgroundColor: theme.backgroundElement }]}>
              {/* Applicant number — prominent */}
              <View style={rdStyles.appNumRow}>
                <View>
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    Applicant Number
                  </ThemedText>
                  <ThemedText style={[rdStyles.appNum, { color: PRIMARY_GREEN }]}>
                    {registration.applicant_number}
                  </ThemedText>
                </View>
                {/* Priority score badge */}
                {registration.priority_score !== undefined && registration.priority_score !== null && (
                  <View style={[rdStyles.scoreBadge, { backgroundColor: PRIMARY_GREEN + '18', borderColor: PRIMARY_GREEN + '40' }]}>
                    <Ionicons name="star" size={12} color={PRIMARY_GREEN} />
                    <ThemedText style={[rdStyles.scoreText, { color: PRIMARY_GREEN }]}>
                      {registration.priority_score} pts
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Divider */}
              <View style={[rdStyles.infoRowDivider, { backgroundColor: theme.backgroundSelected }]} />

              {/* Registered-on */}
              {registeredOn && (
                <View style={rdStyles.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    Registered on
                  </ThemedText>
                  <ThemedText type="small" style={rdStyles.infoRowValue}>
                    {registeredOn}
                  </ThemedText>
                </View>
              )}

              {/* PWD */}
              {registration.is_pwd !== undefined && (
                <View style={rdStyles.infoRow}>
                  <Ionicons name="accessibility-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    PWD
                  </ThemedText>
                  <ThemedText type="small" style={rdStyles.infoRowValue}>
                    {registration.is_pwd ? 'Yes' : 'No'}
                  </ThemedText>
                </View>
              )}

              {/* Age */}
              {registration.age !== undefined && registration.age !== null && (
                <View style={rdStyles.infoRow}>
                  <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    Age at Registration
                  </ThemedText>
                  <ThemedText type="small" style={rdStyles.infoRowValue}>
                    {registration.age} yrs
                  </ThemedText>
                </View>
              )}
            </View>
          </View>

          {/* ══ Section: Drive Details ══════════════════════════════════ */}
          {drive && (
            <View style={rdStyles.section}>
              <View style={rdStyles.sectionHeader}>
                <View style={[rdStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
                <ThemedText style={[rdStyles.sectionTitle, { color: PRIMARY_GREEN }]}>
                  Drive Details
                </ThemedText>
              </View>

              <View style={[rdStyles.infoCard, { backgroundColor: theme.backgroundElement }]}>
                {/* Date */}
                <View style={rdStyles.infoRow}>
                  <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    Date
                  </ThemedText>
                  <ThemedText type="small" style={rdStyles.infoRowValue}>
                    {fmtFullDate(drive.drive_date)}
                  </ThemedText>
                </View>

                <View style={[rdStyles.infoRowDivider, { backgroundColor: theme.backgroundSelected }]} />

                {/* Time */}
                <View style={rdStyles.infoRow}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    Time
                  </ThemedText>
                  <ThemedText type="small" style={rdStyles.infoRowValue}>
                    {fmt12h(drive.time_start)} – {fmt12h(drive.time_end)}
                  </ThemedText>
                </View>

                <View style={[rdStyles.infoRowDivider, { backgroundColor: theme.backgroundSelected }]} />

                {/* Location */}
                <View style={rdStyles.infoRow}>
                  <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    Location
                  </ThemedText>
                  <ThemedText type="small" style={rdStyles.infoRowValue}>
                    {drive.location}
                  </ThemedText>
                </View>

                <View style={[rdStyles.infoRowDivider, { backgroundColor: theme.backgroundSelected }]} />

                {/* Eligibility */}
                <View style={rdStyles.infoRow}>
                  <Ionicons name="people-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    Eligible For
                  </ThemedText>
                  <ThemedText type="small" style={rdStyles.infoRowValue}>
                    {drive.eligible_criteria}
                  </ThemedText>
                </View>

                <View style={[rdStyles.infoRowDivider, { backgroundColor: theme.backgroundSelected }]} />

                {/* Stock */}
                <View style={rdStyles.infoRow}>
                  <Ionicons name="layers-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={rdStyles.infoRowLabel}>
                    {drive.stock_label}
                  </ThemedText>
                  <ThemedText type="small" style={[rdStyles.infoRowValue, { color: PROGRESS_GREEN, fontWeight: '700' }]}>
                    {drive.stock_remaining}/{drive.stock_total} {drive.stock_unit}
                  </ThemedText>
                </View>

                {/* Slim progress bar */}
                <View style={rdStyles.stockBarTrack}>
                  <View
                    style={[
                      rdStyles.stockBarFill,
                      {
                        width: `${Math.round(stock_fraction * 100)}%` as `${number}%`,
                        backgroundColor: PROGRESS_GREEN,
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}

          {/* ══ Section: Status Timeline ════════════════════════════════ */}
          <View style={rdStyles.section}>
            <View style={rdStyles.sectionHeader}>
              <View style={[rdStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
              <ThemedText style={[rdStyles.sectionTitle, { color: PRIMARY_GREEN }]}>
                Status Timeline
              </ThemedText>
            </View>

            <View style={[rdStyles.timelineCard, { backgroundColor: theme.backgroundElement }]}>
              {visibleSteps.map((step, idx) => {
                const isPast    = idx < currentVisibleIdx;
                const isCurrent = idx === currentVisibleIdx;
                const isFuture  = idx > currentVisibleIdx;
                const isLast    = idx === visibleSteps.length - 1;

                // 'confirmed' is brand-colored (live accent), not its module-level fallback.
                const stepColor = step.key === 'confirmed' ? PRIMARY_GREEN : step.color;

                return (
                  <View key={step.key} style={rdStyles.stepRow}>

                    {/* Left column: icon + connector line */}
                    <View style={rdStyles.stepLeft}>
                      {/* Step icon circle */}
                      <View
                        style={[
                          rdStyles.stepCircle,
                          isPast    && { backgroundColor: stepColor, borderColor: stepColor },
                          isCurrent && { backgroundColor: stepColor, borderColor: stepColor },
                          isFuture  && { backgroundColor: 'transparent', borderColor: theme.backgroundSelected },
                        ]}>
                        <Ionicons
                          name={isPast ? 'checkmark' : step.icon}
                          size={isCurrent ? 16 : 14}
                          color={isFuture ? theme.textSecondary : '#ffffff'}
                        />
                      </View>

                      {/* Vertical connector to next step */}
                      {!isLast && (
                        <View style={[rdStyles.stepLine, { backgroundColor: isPast ? stepColor : theme.backgroundSelected }]} />
                      )}
                    </View>

                    {/* Right column: label + description */}
                    <View style={rdStyles.stepRight}>
                      <View style={rdStyles.stepLabelRow}>
                        <ThemedText
                          style={[
                            rdStyles.stepLabel,
                            isCurrent && { color: stepColor },
                            isFuture  && { color: theme.textSecondary, fontWeight: '500' },
                          ]}>
                          {step.label}
                        </ThemedText>
                        {isCurrent && (
                          <View style={[rdStyles.currentBadge, { backgroundColor: stepColor + '22', borderColor: stepColor + '55' }]}>
                            <ThemedText style={[rdStyles.currentBadgeText, { color: stepColor }]}>
                              Current
                            </ThemedText>
                          </View>
                        )}
                      </View>
                      <ThemedText
                        type="small"
                        style={[
                          rdStyles.stepDesc,
                          isFuture && { color: theme.textSecondary, opacity: 0.55 },
                          isCurrent && { color: theme.text },
                        ]}>
                        {step.description}
                      </ThemedText>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>

        </ScrollView>

        {/* ── Close button pinned at the bottom ─────────────────────── */}
        <Pressable
          onPress={onClose}
          style={[rdStyles.closeBtn, { backgroundColor: PRIMARY_GREEN }]}>
          <ThemedText style={rdStyles.closeBtnText}>Close</ThemedText>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

const rdStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.14,
    shadowRadius: 18,
    elevation: 20,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: Spacing.three,
  },
  scrollContent: {
    paddingBottom: Spacing.three,
    gap: 0,
  },
  // ── Header ──────────────────────────────────────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
  driveTitle: {
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 24,
  },
  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  // ── Section chrome ───────────────────────────────────────────────────────
  section: {
    marginBottom: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginBottom: Spacing.two,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // ── Info card (used in Registration Info + Drive Details) ────────────────
  infoCard: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: 6,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  infoRowLabel: {
    width: 112,
    flexShrink: 0,
    fontWeight: '600',
  },
  infoRowValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
  infoRowDivider: {
    height: 1,
    marginVertical: 3,
  },
  // ── Applicant number block ───────────────────────────────────────────────
  appNumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  appNum: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 0.5,
    lineHeight: 28,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
  },
  // ── Stock progress bar ───────────────────────────────────────────────────
  stockBarTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginTop: 6,
    overflow: 'hidden',
  },
  stockBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  // ── Timeline ─────────────────────────────────────────────────────────────
  timelineCard: {
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two + 2,
    paddingBottom: Spacing.two,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepLeft: {
    alignItems: 'center',
    width: 32,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 16,
    borderRadius: 1,
    marginVertical: 3,
  },
  stepRight: {
    flex: 1,
    paddingBottom: Spacing.three,
    gap: 4,
  },
  stepLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stepLabel: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
  },
  currentBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
  // ── Bottom close button ───────────────────────────────────────────────────
  closeBtn: {
    borderRadius: 24,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  closeBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
});

// ─── My Registrations Panel ───────────────────────────────────────────────────

function MyRegistrationsPanel({
  registrations,
  loading,
}: {
  registrations: DriveRegistration[];
  loading: boolean;
}) {
  const theme = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;
  const [statusFilter, setStatusFilter] = useState<RegStatusFilter>('all');
  const [detailReg, setDetailReg]       = useState<DriveRegistration | null>(null);

  const STATUS_COLOR: Record<string, string> = {
    pending:   '#F59E0B',
    confirmed: PRIMARY_GREEN,
    attended:  '#6366F1',
    cancelled: '#EF4444',
  };
  const STATUS_LABEL: Record<string, string> = {
    pending:   'Pending',
    confirmed: 'Confirmed',
    attended:  'Attended',
    cancelled: 'Cancelled',
  };

  const filtered =
    statusFilter === 'all'
      ? registrations
      : registrations.filter((r) => r.status === statusFilter);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={myRegStyles.outerList}
        showsVerticalScrollIndicator={false}>

        {/* ════════════════════════════════════════════════════════════════
            SECTION 1 — Status Filter
        ════════════════════════════════════════════════════════════════ */}
        <View style={sectionStyles.section}>
          <View style={sectionStyles.sectionLabelRow}>
            <View style={[sectionStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
            <ThemedText type="small" style={[sectionStyles.sectionLabel, { color: PRIMARY_GREEN }]}>
              Filter by Status
            </ThemedText>
          </View>

          <View style={[filterPanelStyles.bar, { backgroundColor: theme.backgroundElement }]}>
            <RegStatusFilterBar active={statusFilter} onSelect={setStatusFilter} />
          </View>
        </View>

        {/* Section divider */}
        <View style={[sectionStyles.divider, { backgroundColor: theme.backgroundSelected }]} />

        {/* ════════════════════════════════════════════════════════════════
            SECTION 2 — Registrations List
        ════════════════════════════════════════════════════════════════ */}
        <View style={sectionStyles.section}>
          <View style={sectionStyles.sectionLabelRow}>
            <View style={[sectionStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
            <ThemedText type="small" style={[sectionStyles.sectionLabel, { color: PRIMARY_GREEN }]}>
              My Applications
            </ThemedText>
          </View>

          {loading ? (
            <View style={myRegStyles.center}>
              <ActivityIndicator color={PRIMARY_GREEN} />
            </View>
          ) : registrations.length === 0 ? (
            <View style={myRegStyles.center}>
              <Ionicons name="calendar-outline" size={52} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.two }}>
                You haven't registered for any medical drives yet.
              </ThemedText>
            </View>
          ) : filtered.length === 0 ? (
            <View style={myRegStyles.center}>
              <Ionicons name="filter-outline" size={44} color={theme.textSecondary} />
              <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.two }}>
                No {STATUS_LABEL[statusFilter]?.toLowerCase()} registrations found.
              </ThemedText>
            </View>
          ) : (
            <View style={myRegStyles.list}>
              {filtered.map((reg) => {
                const drive = reg.drive;
                const cfg = drive ? DRIVE_TYPE_CONFIG[drive.type] ?? DRIVE_TYPE_CONFIG.others : null;
                const statusColor = STATUS_COLOR[reg.status] ?? theme.textSecondary;
                const statusLabel = STATUS_LABEL[reg.status] ?? reg.status;

                return (
                  <Pressable
                    key={reg.id}
                    onPress={() => setDetailReg(reg)}
                    style={({ pressed }) => [
                      myRegStyles.card,
                      { backgroundColor: theme.background },
                      pressed && { opacity: 0.82 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`View details for ${drive?.title ?? 'registration'}`}>

                    {/* Drive title + type badge */}
                    <View style={myRegStyles.titleRow}>
                      <ThemedText style={myRegStyles.cardTitle} numberOfLines={2}>
                        {drive?.title ?? '—'}
                      </ThemedText>
                      {cfg && (
                        <View style={[myRegStyles.typeBadge, { backgroundColor: cfg.color + '26' }]}>
                          <ThemedText style={[myRegStyles.typeBadgeText, { color: cfg.color }]}>
                            {cfg.label}
                          </ThemedText>
                        </View>
                      )}
                    </View>

                    {/* Date · time · location */}
                    {drive && (
                      <ThemedText type="small" themeColor="textSecondary">
                        {fmtShortDate(drive.drive_date)} · {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
                        {'  ·  '}{drive.location}
                      </ThemedText>
                    )}

                    {/* Bottom row: applicant # · status pill · chevron hint */}
                    <View style={myRegStyles.bottomRow}>
                      <View style={myRegStyles.appNumWrap}>
                        <ThemedText type="small" themeColor="textSecondary">Applicant #</ThemedText>
                        <ThemedText type="smallBold" style={{ color: PRIMARY_GREEN }}>
                          {reg.applicant_number}
                        </ThemedText>
                      </View>
                       <View style={myRegStyles.bottomRight}>
                         <View style={[myRegStyles.statusPill, { backgroundColor: statusColor + '22' }]}>
                           <View style={[myRegStyles.statusDot, { backgroundColor: statusColor }]} />
                           <ThemedText type="small" style={{ color: statusColor, fontWeight: '600' }}>
                             {statusLabel}
                           </ThemedText>
                         </View>
                       </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* ── Registration detail bottom sheet ──────────────────────────── */}
      <RegistrationDetailSheet
        registration={detailReg}
        visible={detailReg !== null}
        onClose={() => setDetailReg(null)}
      />
    </>
  );
}

const myRegStyles = StyleSheet.create({
  // Outer scroll content — sections render directly inside
  outerList: {
    paddingBottom: 40,
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
  },
  list: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  card: {
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 20,
  },
  typeBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.one,
  },
  appNumWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bottomRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

// ─── Root Screen ─────────────────────────────────────────────────────────────

type HealthSegment = 'active-drives' | 'my-registrations';

export default function HealthScreen() {
  const theme = useTheme();
  // Shadows the module-level fallback — see the shadow comment in MonthYearPicker above.
  const PRIMARY_GREEN = theme.primary;
  const insets = useSafeAreaInsets();
  const { session, isGuest } = useAuth();

  const [segment, setSegment]           = useState<HealthSegment>('active-drives');
  const [selectedDate, setSelectedDate]  = useState<string>(localToday);
  const [typeFilter, setTypeFilter]      = useState<DriveTypeFilter>('all');
  const [monthViewActive, setMonthViewActive] = useState(false);
  const [currentMonth, setCurrentMonth]  = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  });
  const [modalDrive, setModalDrive]      = useState<MedicalDrive | null>(null);

  const {
    drives,
    loadingDrives,
    monthEventMap,
    fetchMonthEventDates,
    monthDrives,
    loadingMonthDrives,
    fetchMonthDrives,
    myRegistrations,
    loadingRegistrations,
    registeredDriveIds,
    registerForDrive,
    error,
  } = useMedicalDrives({ selectedDate, typeFilter });

  // Re-fetch calendar event dots whenever the visible month changes
  useEffect(() => {
    fetchMonthEventDates(currentMonth.year, currentMonth.month);
  }, [currentMonth, fetchMonthEventDates]);

  // Re-fetch month drives whenever month view is active or context changes.
  // `fetchMonthDrives` is recreated when `typeFilter` changes, so this
  // effect re-runs automatically when the user changes the category filter.
  useEffect(() => {
    if (monthViewActive) {
      fetchMonthDrives(currentMonth.year, currentMonth.month);
    }
  }, [currentMonth, fetchMonthDrives, monthViewActive]);

  const handleMonthChange = (delta: 1 | -1) => {
    setCurrentMonth((prev) => {
      let m = prev.month + delta;
      let y = prev.year;
      if (m > 12) { m = 1;  y++; }
      if (m < 1)  { m = 12; y--; }
      return { year: y, month: m };
    });
  };

  /** Called when the user picks a month+year from the picker dialog. */
  const handleJumpTo = (year: number, month: number) => {
    setCurrentMonth({ year, month });
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    // Tapping a specific date exits month-view and shows that date's drives
    setMonthViewActive(false);
    // Snap visible month if user taps a trailing/leading cell from adjacent month
    const d = parseLocalDate(date);
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  const handleRegister = (drive: MedicalDrive) => {
    if (!session && !isGuest) {
      Alert.alert('Sign In Required', 'Please sign in to register for a medical drive.');
      return;
    }
    if (!session) {
      Alert.alert('Sign In Required', 'Guest mode does not support registrations. Please sign in.');
      return;
    }
    // Navigate to the full-screen Applicant Registration form.
    router.push({ pathname: '/(app)/health/register', params: { driveId: drive.id } });
  };

  // ── Drive list to render (date-view vs month-view) ────────────────────────
  const activeDrives   = monthViewActive ? monthDrives : drives;
  const activeDriveLoading = monthViewActive ? loadingMonthDrives : loadingDrives;

  return (
    <SafeAreaView style={[rootStyles.safeArea, { backgroundColor: PRIMARY_GREEN }]}>
      <View style={[rootStyles.root, { backgroundColor: theme.background }]}>
        {/* ── Green header bar ─────────────────────────────────────────────── */}
        <View
          style={[
            rootStyles.header,
            { backgroundColor: PRIMARY_GREEN, paddingTop: insets.top + Spacing.two },
          ]}>
          {/* height:25 matches maps screen headerContent height */}
          <View style={rootStyles.headerContent}>
            <ThemedText style={[rootStyles.headerTitle, { color: theme.onPrimary }]}>
              Health and Medical Drive Info
            </ThemedText>
          </View>
        </View>

      {/* ── Segmented control ────────────────────────────────────────────── */}
      <ThemedView style={rootStyles.segmentRow}>
        <SegmentedControl
          segments={[
            { key: 'active-drives',      label: 'Active Medical Drives' },
            { key: 'my-registrations',   label: 'My Registrations' },
          ]}
          activeKey={segment}
          onChange={setSegment}
        />
      </ThemedView>

      {/* ── Active Medical Drives ─────────────────────────────────────────── */}
      {segment === 'active-drives' && (
        <ScrollView
          style={rootStyles.scroll}
          contentContainerStyle={rootStyles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">

          {/* ════════════════════════════════════════════════════════════════
              SECTION 1 — Calendar
          ════════════════════════════════════════════════════════════════ */}
          <View style={sectionStyles.section}>
            <View style={sectionStyles.sectionLabelRow}>
              <View style={[sectionStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
              <ThemedText type="small" style={[sectionStyles.sectionLabel, { color: PRIMARY_GREEN }]}>
                Calendar
              </ThemedText>
            </View>
            <DriveCalendar
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              eventDateMap={monthEventMap}
              currentMonth={currentMonth}
              onMonthChange={handleMonthChange}
              onJumpTo={handleJumpTo}
            />
          </View>

          {/* Section divider */}
          <View style={[sectionStyles.divider, { backgroundColor: theme.backgroundSelected }]} />

          {/* ════════════════════════════════════════════════════════════════
              SECTION 2 — Month toggle + category filters
          ════════════════════════════════════════════════════════════════ */}
          <View style={sectionStyles.section}>
            <View style={sectionStyles.sectionLabelRow}>
              <View style={[sectionStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
              <ThemedText type="small" style={[sectionStyles.sectionLabel, { color: PRIMARY_GREEN }]}>
                Filter Drives
              </ThemedText>
            </View>

            {/* Filter bar — month toggle + chips on one row */}
            <View style={[filterPanelStyles.bar, { backgroundColor: theme.backgroundElement }]}>
              {/* Month-view icon toggle (compact square button) */}
              <Pressable
                onPress={() => setMonthViewActive((v) => !v)}
                accessibilityRole="button"
                accessibilityState={{ selected: monthViewActive }}
                accessibilityLabel={
                  monthViewActive
                    ? `Showing all drives for ${MONTH_NAMES[currentMonth.month - 1]}. Tap to clear.`
                    : `Show all drives for ${MONTH_NAMES[currentMonth.month - 1]}`
                }
                style={[
                  filterPanelStyles.monthIconBtn,
                  monthViewActive
                    ? { backgroundColor: PRIMARY_GREEN }
                    : { backgroundColor: 'transparent' },
                ]}>
                <Ionicons
                  name={monthViewActive ? 'calendar' : 'calendar-outline'}
                  size={17}
                  color={monthViewActive ? '#ffffff' : PRIMARY_GREEN}
                />
              </Pressable>

              {/* Vertical separator */}
              <View style={[filterPanelStyles.vSep, { backgroundColor: theme.backgroundSelected }]} />

              {/* Chip scroll — fills remaining width */}
              <HorizontalCategoryNav active={typeFilter} onSelect={setTypeFilter} />
            </View>

            {/* Month-view active label — slim single-line indicator */}
            {monthViewActive && (
              <View style={filterPanelStyles.monthLabelRow}>
                <ThemedText type="small" style={[filterPanelStyles.monthLabelText, { color: PRIMARY_GREEN }]}>
                  All drives for {MONTH_NAMES[currentMonth.month - 1]} {currentMonth.year}
                </ThemedText>
                <Pressable onPress={() => setMonthViewActive(false)} hitSlop={8}>
                  <Ionicons name="close-circle" size={14} color={PRIMARY_GREEN} />
                </Pressable>
              </View>
            )}
          </View>

          {/* Section divider */}
          <View style={[sectionStyles.divider, { backgroundColor: theme.backgroundSelected }]} />

          {/* ════════════════════════════════════════════════════════════════
              SECTION 3 — Date / Month header
          ════════════════════════════════════════════════════════════════ */}
          <View style={sectionStyles.section}>
            <View style={sectionStyles.sectionLabelRow}>
              <View style={[sectionStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
              <ThemedText type="small" style={[sectionStyles.sectionLabel, { color: PRIMARY_GREEN }]}>
                {monthViewActive ? 'Viewing Month' : 'Selected Date'}
              </ThemedText>
            </View>

            {monthViewActive ? (
              /* Month-view — single pill row: calendar icon · Month · Year */
              <View style={[dateHdrStyles.row, { borderColor: PRIMARY_GREEN, backgroundColor: PRIMARY_GREEN + '0D' }]}>
                <Ionicons name="calendar" size={15} color={PRIMARY_GREEN} />
                <ThemedText style={[dateHdrStyles.rowText, { color: PRIMARY_GREEN }]}>
                  {MONTH_NAMES[currentMonth.month - 1]}
                </ThemedText>
                <View style={[dateHdrStyles.yearPill, { backgroundColor: PRIMARY_GREEN + '22' }]}>
                  <ThemedText style={[dateHdrStyles.yearPillText, { color: PRIMARY_GREEN }]}>
                    {currentMonth.year}
                  </ThemedText>
                </View>
              </View>
            ) : (
              /* Date-view — single pill row: weekday · dot · month day · Today tag */
              <View style={[dateHdrStyles.row, { borderColor: PRIMARY_GREEN, backgroundColor: PRIMARY_GREEN + '0D' }]}>
                <Ionicons name="today-outline" size={15} color={PRIMARY_GREEN} />
                {/* Weekday */}
                <ThemedText style={[dateHdrStyles.rowText, { color: PRIMARY_GREEN }]}>
                  {parseLocalDate(selectedDate).toLocaleDateString('en-US', { weekday: 'long' })}
                </ThemedText>
                {/* Separator dot */}
                <View style={[dateHdrStyles.dot, { backgroundColor: PRIMARY_GREEN + '55' }]} />
                {/* Month + day */}
                <ThemedText style={[dateHdrStyles.rowSub, { color: PRIMARY_GREEN }]}>
                  {parseLocalDate(selectedDate).toLocaleDateString('en-US', { month: 'short' })}{' '}
                  {parseLocalDate(selectedDate).getDate()}
                </ThemedText>
                {/* "Today" tag — right-aligned via flex spacer */}
                {selectedDate === localToday() && (
                  <>
                    <View style={{ flex: 1 }} />
                    <View style={[dateHdrStyles.todayTag, { backgroundColor: PRIMARY_GREEN }]}>
                      <ThemedText style={dateHdrStyles.todayTagText}>Today</ThemedText>
                    </View>
                  </>
                )}
              </View>
            )}
          </View>

          {/* Section divider */}
          <View style={[sectionStyles.divider, { backgroundColor: theme.backgroundSelected }]} />

          {/* ════════════════════════════════════════════════════════════════
              SECTION 4 — Drive list
          ════════════════════════════════════════════════════════════════ */}
          <View style={sectionStyles.section}>
            <View style={sectionStyles.sectionLabelRow}>
              <View style={[sectionStyles.sectionAccent, { backgroundColor: PRIMARY_GREEN }]} />
              <ThemedText type="small" style={[sectionStyles.sectionLabel, { color: PRIMARY_GREEN }]}>
                Medical Drives
              </ThemedText>
            </View>

            {activeDriveLoading ? (
              <View style={rootStyles.loadingBox}>
                <ActivityIndicator color={PRIMARY_GREEN} />
              </View>
            ) : !monthViewActive && error ? (
              <View style={rootStyles.loadingBox}>
                <Ionicons name="alert-circle-outline" size={32} color="#EF4444" />
                <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  {error}
                </ThemedText>
              </View>
            ) : activeDrives.length === 0 ? (
              <View style={rootStyles.emptyBox}>
                <Ionicons name="medkit-outline" size={44} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={{ textAlign: 'center' }}>
                  {monthViewActive
                    ? `No active medical drives in ${MONTH_NAMES[currentMonth.month - 1]}`
                    : 'No medical drives on this date'}
                  {typeFilter !== 'all' ? ` for ${DRIVE_TYPE_CONFIG[typeFilter].label}` : ''}.
                </ThemedText>
              </View>
            ) : (
              activeDrives.map((drive) => (
                <DriveCard
                  key={drive.id}
                  drive={drive}
                  isRegistered={registeredDriveIds.has(drive.id)}
                  onRegister={() => handleRegister(drive)}
                />
              ))
            )}
          </View>
        </ScrollView>
      )}

      {/* ── My Registrations ─────────────────────────────────────────────── */}
      {segment === 'my-registrations' && (
        <MyRegistrationsPanel
          registrations={myRegistrations}
          loading={loadingRegistrations}
        />
      )}

      {/* ── Registration modal ────────────────────────────────────────────── */}
      <RegistrationModal
        drive={modalDrive}
        visible={modalDrive !== null}
        onClose={() => setModalDrive(null)}
        onConfirm={registerForDrive}
      />
    </View>
    </SafeAreaView>
  );
}

const rootStyles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingBottom: Spacing.three,
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
  },
  segmentRow: {
    padding: Spacing.three,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  loadingBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
    gap: Spacing.two,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.five,
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
  },
});

// ─── Section layout styles ────────────────────────────────────────────────────

const sectionStyles = StyleSheet.create({
  section: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    marginHorizontal: Spacing.three,
  },
});

// ─── Filter panel (Section 2) ─────────────────────────────────────────────────

const filterPanelStyles = StyleSheet.create({
  // Single-row bar containing the month icon button + chip scroll
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    borderRadius: 10,
    overflow: 'hidden',
    height: 42,
  },
  // Compact square icon-only toggle on the left of the bar
  monthIconBtn: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  // Thin vertical rule between the icon button and the chip scroll
  vSep: {
    width: 1,
    height: 24,
    flexShrink: 0,
  },
  // Slim indicator shown below the bar when month-view is active
  monthLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginHorizontal: Spacing.three,
    marginTop: 5,
  },
  monthLabelText: {
    fontWeight: '600',
    fontSize: 11,
    lineHeight: 15,
  },
});

// ─── Date header card (Section 3) ────────────────────────────────────────────

const dateHdrStyles = StyleSheet.create({
  // Shared single-row pill container
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: Spacing.three,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  // Primary label (weekday name or month name)
  rowText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 18,
  },
  // Secondary label (short month + day number)
  rowSub: {
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
    opacity: 0.85,
  },
  // Small separator dot between weekday and month-day
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  // "Today" right-aligned compact tag
  todayTag: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  todayTagText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 15,
  },
  // Month-view: year pill next to month name
  yearPill: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  yearPillText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
});
