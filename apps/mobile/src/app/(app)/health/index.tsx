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
import { Ionicons } from '@expo/vector-icons';
import { DRIVE_TYPES, DRIVE_TYPE_CONFIG as SHARED_DRIVE_TYPE_CONFIG } from '@barangayan/shared';
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProgressBar } from '@/components/progress-bar';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { type DriveType, type MedicalDrive, type DriveRegistration, useMedicalDrives } from '@/hooks/use-medical-drives';
import { useTheme } from '@/hooks/use-theme';

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIMARY_GREEN = Colors.light.primary; // #0F6E5B — always brand green (not accent-color)
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
  all: { label: 'All', color: PRIMARY_GREEN },
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

            <ThemedText style={mpStyles.yearText}>{pickerYear}</ThemedText>

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
    color: PRIMARY_GREEN,
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
        {/* Tapping "August 2026 ▾" opens the picker */}
        <Pressable
          style={calStyles.monthLabel}
          hitSlop={8}
          onPress={() => setPickerVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Open month and year picker, currently ${MONTH_NAMES[month - 1]} ${year}`}>
          <ThemedText type="smallBold" style={{ color: PRIMARY_GREEN, fontSize: 16 }}>
            {MONTH_NAMES[month - 1]} {year}
          </ThemedText>
          <Ionicons
            name={pickerVisible ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={PRIMARY_GREEN}
          />
        </Pressable>
        <View style={calStyles.navRow}>
          <Pressable onPress={() => onMonthChange(-1)} hitSlop={10} style={calStyles.navBtn}>
            <Ionicons name="chevron-back" size={18} color={theme.text} />
          </Pressable>
          <Pressable onPress={() => onMonthChange(1)} hitSlop={10} style={calStyles.navBtn}>
            <Ionicons name="chevron-forward" size={18} color={theme.text} />
          </Pressable>
        </View>
      </View>

      {/* Day-of-week headers */}
      <View style={calStyles.dayHeaderRow}>
        {DAY_LABELS.map((l, i) => (
          <View key={i} style={calStyles.dayHeaderCell}>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={calStyles.dayHeaderText}>
              {l}
            </ThemedText>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={calStyles.row}>
          {row.map((cell, ci) => {
            const isSelected   = cell.date === selectedDate;
            const isToday      = cell.date === today;
            // Colors from eventDateMap — up to 3 distinct type colors
            const eventColors  = eventDateMap[cell.date] ?? [];
            const hasEvent     = eventColors.length > 0;

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
                    isToday && !isSelected && {
                      borderWidth: 2,
                      borderColor: PRIMARY_GREEN,
                    },
                  ]}>
                  <ThemedText
                    type="small"
                    style={[
                      calStyles.dayNum,
                      !cell.inMonth && { color: theme.textSecondary, opacity: 0.5 },
                      isSelected && { color: '#ffffff', fontWeight: '700' },
                      isToday && !isSelected && { color: PRIMARY_GREEN, fontWeight: '700' },
                    ]}>
                    {cell.day}
                  </ThemedText>
                </View>

                {/* Colored dots — one per drive type scheduled on this date */}
                {hasEvent && (
                  <View style={calStyles.dotsRow}>
                    {eventColors.slice(0, 3).map((color, idx) => (
                      <View
                        key={idx}
                        style={[
                          calStyles.eventDot,
                          { backgroundColor: isSelected ? '#ffffff' : color },
                        ]}
                      />
                    ))}
                  </View>
                )}
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
    borderRadius: 16,
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.two,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    padding: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
    marginBottom: Spacing.half,
  },
  monthLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  navBtn: {
    padding: 4,
  },
  dayHeaderRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  dayHeaderCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayHeaderText: {
    fontWeight: '600',
    fontSize: 12,
  },
  row: {
    flexDirection: 'row',
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 3,
  },
  circle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: {
    fontSize: 14,
    lineHeight: 18,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
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
        style={[hcnStyles.chevron, !canScrollLeft && hcnStyles.chevronFaded]}>
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
          const { label, color } = DRIVE_TYPE_CONFIG[key];
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
        style={[hcnStyles.chevron, !canScrollRight && hcnStyles.chevronFaded]}>
        <Ionicons name="chevron-forward" size={18} color={PRIMARY_GREEN} />
      </Pressable>
    </View>
  );
}

const hcnStyles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.two,
  },
  chevron: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: PRIMARY_GREEN + '18',
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
  const cfg = DRIVE_TYPE_CONFIG[drive.type] ?? DRIVE_TYPE_CONFIG.others;
  const fraction = drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0;

  return (
    <View style={[dCardStyles.card, { backgroundColor: theme.background }]}>
      {/* Title + badge */}
      <View style={dCardStyles.titleRow}>
        <ThemedText style={dCardStyles.title} numberOfLines={2}>
          {drive.title}
        </ThemedText>
        <View style={[dCardStyles.badge, { backgroundColor: cfg.color + '26' }]}>
          <ThemedText style={[dCardStyles.badgeText, { color: cfg.color }]}>
            {cfg.label}
          </ThemedText>
        </View>
      </View>

      {/* Date · time · location */}
      <ThemedText type="small" themeColor="textSecondary" style={dCardStyles.info}>
        {fmtShortDate(drive.drive_date)}
        {' · '}
        {fmt12h(drive.time_start)}–{fmt12h(drive.time_end)}
        {' · '}
        {drive.location}
      </ThemedText>

      {/* Eligibility */}
      <ThemedText type="small" themeColor="textSecondary" style={dCardStyles.info}>
        Eligible: {drive.eligible_criteria}
      </ThemedText>

      {/* Stock row */}
      <View style={dCardStyles.stockRow}>
        <ThemedText type="smallBold">{drive.stock_label}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {drive.stock_remaining} / {drive.stock_total} {drive.stock_unit}
        </ThemedText>
      </View>

      <ProgressBar fraction={fraction} color={PROGRESS_GREEN} />

      {/* Footer action */}
      <View style={dCardStyles.footer}>
        {isRegistered ? (
          <View style={dCardStyles.registeredPill}>
            <Ionicons name="checkmark-circle" size={13} color={PRIMARY_GREEN} />
            <ThemedText type="small" style={{ color: PRIMARY_GREEN, fontWeight: '600' }}>
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
                  drive.stock_remaining === 0
                    ? theme.backgroundSelected
                    : PRIMARY_GREEN,
              },
            ]}>
            <ThemedText
              type="smallBold"
              style={{
                color:
                  drive.stock_remaining === 0 ? theme.textSecondary : '#ffffff',
              }}>
              {drive.stock_remaining === 0 ? 'Full' : 'Register'}
            </ThemedText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const dCardStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderRadius: 16,
    padding: Spacing.three,
    gap: Spacing.two,
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    // Android shadow
    elevation: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  info: {
    lineHeight: 18,
  },
  stockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 2,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 2,
  },
  registerBtn: {
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  registeredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: PRIMARY_GREEN + '18',
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
              <ThemedText type="smallBold" style={modalStyles.successTitle}>
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
    color: PRIMARY_GREEN,
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

// ─── My Registrations Panel ───────────────────────────────────────────────────

function MyRegistrationsPanel({
  registrations,
  loading,
}: {
  registrations: DriveRegistration[];
  loading: boolean;
}) {
  const theme = useTheme();

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

  if (loading) {
    return (
      <View style={myRegStyles.center}>
        <ActivityIndicator color={PRIMARY_GREEN} />
      </View>
    );
  }

  if (registrations.length === 0) {
    return (
      <View style={myRegStyles.center}>
        <Ionicons name="calendar-outline" size={52} color={theme.textSecondary} />
        <ThemedText themeColor="textSecondary" style={{ textAlign: 'center', marginTop: Spacing.two }}>
          You haven't registered for any medical drives yet.
        </ThemedText>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={myRegStyles.list}
      showsVerticalScrollIndicator={false}>
      {registrations.map((reg) => {
        const drive = reg.drive;
        const cfg = drive ? DRIVE_TYPE_CONFIG[drive.type] ?? DRIVE_TYPE_CONFIG.others : null;
        const statusColor = STATUS_COLOR[reg.status] ?? theme.textSecondary;
        const statusLabel = STATUS_LABEL[reg.status] ?? reg.status;

        return (
          <View key={reg.id} style={[myRegStyles.card, { backgroundColor: theme.background }]}>
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

            {/* Applicant number + status pill */}
            <View style={myRegStyles.bottomRow}>
              <View style={myRegStyles.appNumWrap}>
                <ThemedText type="small" themeColor="textSecondary">Applicant #</ThemedText>
                <ThemedText type="smallBold" style={{ color: PRIMARY_GREEN }}>
                  {reg.applicant_number}
                </ThemedText>
              </View>
              <View style={[myRegStyles.statusPill, { backgroundColor: statusColor + '22' }]}>
                <ThemedText type="small" style={{ color: statusColor, fontWeight: '600' }}>
                  {statusLabel}
                </ThemedText>
              </View>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const myRegStyles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.six,
    gap: Spacing.two,
  },
  list: {
    padding: Spacing.three,
    gap: Spacing.three,
    paddingBottom: Spacing.six,
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
  statusPill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});

// ─── Root Screen ─────────────────────────────────────────────────────────────

type HealthSegment = 'active-drives' | 'my-registrations';

export default function HealthScreen() {
  const theme = useTheme();
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
    <View style={[rootStyles.root, { backgroundColor: theme.background }]}>
      {/* ── Green header bar ─────────────────────────────────────────────── */}
      <View
        style={[
          rootStyles.header,
          { backgroundColor: PRIMARY_GREEN, paddingTop: insets.top + Spacing.two },
        ]}>
        <ThemedText style={rootStyles.headerTitle}>
          Health and Medical Drive Info
        </ThemedText>
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

          {/* Calendar — dots are colored per drive type */}
          <DriveCalendar
            selectedDate={selectedDate}
            onDateSelect={handleDateSelect}
            eventDateMap={monthEventMap}
            currentMonth={currentMonth}
            onMonthChange={handleMonthChange}
            onJumpTo={handleJumpTo}
          />

          {/* ── Month-view filter toggle ──────────────────────────────────── */}
          <Pressable
            onPress={() => setMonthViewActive((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ selected: monthViewActive }}
            style={[
              monthBtnStyles.btn,
              monthViewActive
                ? { backgroundColor: PRIMARY_GREEN, borderColor: PRIMARY_GREEN }
                : { borderColor: PRIMARY_GREEN },
            ]}>
            <Ionicons
              name="calendar"
              size={15}
              color={monthViewActive ? '#ffffff' : PRIMARY_GREEN}
            />
            <ThemedText
              type="small"
              style={[monthBtnStyles.label, { color: monthViewActive ? '#ffffff' : PRIMARY_GREEN }]}>
              All Medical Drives for {MONTH_NAMES[currentMonth.month - 1]}
            </ThemedText>
            {monthViewActive && (
              <Ionicons name="close-circle" size={15} color="#ffffff" style={{ marginLeft: 2 }} />
            )}
          </Pressable>

          {/* ── Horizontal category filter ────────────────────────────────── */}
          <HorizontalCategoryNav active={typeFilter} onSelect={setTypeFilter} />

          {/* ── Header card: date or month ────────────────────────────────── */}
          <View style={[dateHdrStyles.card, { borderColor: PRIMARY_GREEN }]}>
            <ThemedText style={[dateHdrStyles.text, { color: PRIMARY_GREEN }]}>
              {monthViewActive
                ? `${MONTH_NAMES[currentMonth.month - 1]} ${currentMonth.year}`
                : fmtFullDate(selectedDate)}
            </ThemedText>
          </View>

          {/* ── Drive list ────────────────────────────────────────────────── */}
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
  );
}

const rootStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.three,
    minHeight: 60,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 24,
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

const dateHdrStyles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.three,
    marginBottom: Spacing.three,
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
});

const monthBtnStyles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.one,
    marginBottom: Spacing.half,
    borderWidth: 1.5,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: 'flex-start',
  },
  label: {
    fontWeight: '600',
    fontSize: 13,
    lineHeight: 18,
  },
});
