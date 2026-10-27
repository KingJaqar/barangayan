import { DRIVE_TYPES, DRIVE_TYPE_CONFIG } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WheelColumn } from '@/components/birthday-wheel-modal';
import { FilterChips } from '@/components/filter-chips';
import {
  HealthDriveSummary,
  HealthFact,
  HealthPanel,
  HealthSheet,
  HealthStatus,
  healthDate,
  healthTime,
  healthTypeColor,
} from '@/components/health/health-presentation';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ProgressBar } from '@/components/progress-bar';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import {
  type DriveRegistration,
  type DriveType,
  type MedicalDrive,
  useMedicalDrives,
} from '@/hooks/use-medical-drives';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const STATUSES = ['all', 'pending', 'confirmed', 'attended', 'cancelled'] as const;
type StatusFilter = (typeof STATUSES)[number];
type HealthSegment = 'active-drives' | 'my-registrations';
type Month = { year: number; month: number };
const pad2 = (n: number) => String(n).padStart(2, '0');
function parseLocalDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}
function localToday() {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

function shiftDate(iso: string, days: number) {
  const d = parseLocalDate(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function weekStartOf(iso: string) {
  return shiftDate(iso, -parseLocalDate(iso).getDay());
}

const PICKER_ROW = 60;
const PICKER_ROWS = 5;

function MonthYearPicker({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  value: Month;
  onSelect: (year: number, month: number) => void;
  onClose: () => void;
}) {
  const { resident } = useTheme();
  const [draft, setDraft] = useState<Month>(value);
  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);
  const thisYear = new Date().getFullYear();
  const years = Array.from({ length: 7 }, (_, i) => ({ value: thisYear - 1 + i, label: String(thisYear - 1 + i) }));
  if (!years.some((y) => y.value === draft.year)) years.push({ value: draft.year, label: String(draft.year) });
  years.sort((x, y) => x.value - y.value);
  const months = MONTH_NAMES.map((label, i) => ({ value: i + 1, label }));
  return (
    <HealthSheet visible={visible} title="Select Month & Year" onClose={onClose} scrollable={false}
      footer={
        <View style={styles.pickerFooter}>
          <View style={{ flex: 1 }}>
            <PrimaryButton presentation="resident" label="Close" variant="secondary" onPress={onClose} />
          </View>
          <View style={{ flex: 1 }}>
            <PrimaryButton
              presentation="resident"
              label="Done"
              onPress={() => {
                onSelect(draft.year, draft.month);
                onClose();
              }}
            />
          </View>
        </View>
      }>
      <View style={styles.wheels}>
        <View pointerEvents="none" style={[styles.wheelSelection, { backgroundColor: resident.accentSoft }]} />
        <WheelColumn label="Month" items={months} value={draft.month} onChange={(month) => setDraft((d) => ({ ...d, month }))} rowHeight={PICKER_ROW} visibleRows={PICKER_ROWS} boldSelected wide />
        <WheelColumn label="Year" items={years} value={draft.year} onChange={(year) => setDraft((d) => ({ ...d, year }))} rowHeight={PICKER_ROW} visibleRows={PICKER_ROWS} boldSelected wide />
      </View>
    </HealthSheet>
  );
}

const WEEKDAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const EXPAND_MS = 280;

function DriveCalendar({
  selectedDate,
  onDateSelect,
  eventDateMap,
  currentMonth,
  onMonthChange,
  onJumpTo,
}: {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  eventDateMap: Record<string, string[]>;
  currentMonth: Month;
  onMonthChange: (delta: 1 | -1) => void;
  onJumpTo: (year: number, month: number) => void;
}) {
  const { resident } = useTheme();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [gridWidth, setGridWidth] = useState(280);
  const { year, month } = currentMonth;
  const reducedMotion = useResidentReducedMotion(true);
  const gridOpacity = useRef(new Animated.Value(1)).current;
  const [expanded, setExpanded] = useState(false);
  const [weekStart, setWeekStart] = useState(() => weekStartOf(selectedDate));
  const [pagerWidth, setPagerWidth] = useState(300);
  const [weekHeight, setWeekHeight] = useState(0);
  const [monthHeight, setMonthHeight] = useState(0);
  const weekMiddle = parseLocalDate(shiftDate(weekStart, 3));

  // Week pager: three pages (previous, current, next) sit in one row and `drag` is a
  // native-driven translateX, so finger-follow and snapping never touch the JS thread.
  const drag = useRef(new Animated.Value(0)).current;
  const sliding = useRef(false);
  // Expand/collapse: one JS-driven height + slide so the card resizes smoothly.
  const boxHeight = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  const sized = useRef(false);
  // Only one calendar is ever visible: the week strip at rest, otherwise the month grid,
  // which the animated box height slides open / closed from the top.
  const [settled, setSettled] = useState(true);
  // 1 = week strip visible, 0 = month grid visible; only animated once a slide has finished.
  const swap = useRef(new Animated.Value(1)).current;
  const monthSwap = swap.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const showWeek = !expanded && settled;

  useEffect(() => {
    setWeekStart(weekStartOf(selectedDate));
  }, [selectedDate]);
  // Runs before paint: the new week is committed in the centre page, so reset the offset in the same frame.
  useLayoutEffect(() => {
    drag.setValue(0);
    sliding.current = false;
  }, [weekStart, drag]);

  useEffect(() => {
    if (!weekHeight || !monthHeight) return;
    const target = expanded ? monthHeight : weekHeight;
    if (!sized.current || reducedMotion) {
      sized.current = true;
      boxHeight.setValue(target);
      reveal.setValue(expanded ? 1 : 0);
      swap.setValue(expanded ? 0 : 1);
      setSettled(true);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(boxHeight, { toValue: target, duration: EXPAND_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
      Animated.timing(reveal, { toValue: expanded ? 1 : 0, duration: EXPAND_MS, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }),
    ]);
    animation.start(({ finished }) => {
      if (!finished) return;
      setSettled(true);
      // Slide is done: fade the finished state in.
      const fade = Easing.out(Easing.cubic);
      // Mirror of collapse: the old layer stays put through the slide, then cross-fades to the new one.
      Animated.timing(swap, { toValue: expanded ? 0 : 1, duration: 220, easing: fade, useNativeDriver: true }).start();
    });
    return () => animation.stop();
  }, [expanded, weekHeight, monthHeight, reducedMotion, boxHeight, reveal, swap, gridOpacity]);

  const toggleExpanded = () => {
    setSettled(false);
    // Collapsing starts from the month grid; expanding keeps the week strip until the slide ends.
    if (expanded) swap.setValue(0);
    setWeekStart(weekStartOf(selectedDate));
    setExpanded((value) => !value);
  };
  const slideWeek = (dir: 1 | -1) => {
    if (sliding.current) return;
    sliding.current = true;
    const commit = () => {
      const next = shiftDate(weekStart, dir * 7);
      const middle = parseLocalDate(shiftDate(next, 3));
      setWeekStart(next);
      if (middle.getMonth() + 1 !== month || middle.getFullYear() !== year) {
        onJumpTo(middle.getFullYear(), middle.getMonth() + 1);
      }
    };
    if (reducedMotion) {
      commit();
      return;
    }
    Animated.timing(drag, {
      toValue: -dir * pagerWidth,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) commit();
      else sliding.current = false;
    });
  };
  const snapBack = () => {
    Animated.timing(drag, { toValue: 0, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const latest = useRef({ slideWeek, snapBack, pagerWidth });
  latest.current = { slideWeek, snapBack, pagerWidth };
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        !sliding.current && Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_e, g) => {
        const w = latest.current.pagerWidth;
        drag.setValue(Math.max(-w, Math.min(w, g.dx)));
      },
      onPanResponderRelease: (_e, g) => {
        const w = latest.current.pagerWidth;
        if (Math.abs(g.dx) > w * 0.25 || Math.abs(g.vx) > 0.5) {
          latest.current.slideWeek(g.dx < 0 ? 1 : -1);
        } else {
          latest.current.snapBack();
        }
      },
      onPanResponderTerminate: () => latest.current.snapBack(),
    }),
  ).current;

  const calendarKey = `${year}-${month}-${selectedDate}`;
  const previousCalendar = useRef(calendarKey);
  useEffect(() => {
    if (previousCalendar.current === calendarKey) return;
    previousCalendar.current = calendarKey;
    if (reducedMotion) {
      gridOpacity.setValue(1);
      return;
    }
    // One native opacity animation for the grid; no per-day work or animated layout.
    gridOpacity.setValue(0.72);
    const animation = Animated.timing(gridOpacity, {
      toValue: 1, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => { animation.stop(); gridOpacity.setValue(1); };
  }, [calendarKey, reducedMotion, gridOpacity]);
  const offset = new Date(year, month - 1, 1).getDay();
  const total = Math.ceil((offset + new Date(year, month, 0).getDate()) / 7) * 7;
  const cells = Array.from({ length: total }, (_, i) => {
    const date = new Date(year, month - 1, i - offset + 1, 12);
    return {
      date: `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`,
      day: date.getDate(),
      inMonth: date.getMonth() === month - 1,
    };
  });
  const renderDay = (date: string, day: number, inMonth: boolean, circleWidth: number) => {
    const selected = date === selectedDate;
    return (
      <Pressable
        key={date}
        accessibilityRole="button"
        accessibilityLabel={healthDate(date, true)}
        accessibilityState={{ selected }}
        onPress={() => onDateSelect(date)}
        style={({ pressed }) => [styles.dayColumn, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
      >
        <View
          style={[
            styles.dayCircle,
            {
              width: Math.min(32, circleWidth / 7),
              backgroundColor: selected ? resident.accent : 'transparent',
              borderColor:
                selected && resident.accentNeedsOutline
                  ? resident.controlBorder
                  : !selected && date === localToday()
                    ? resident.accentText
                    : 'transparent',
            },
          ]}
        >
          <ThemedText
            style={[
              styles.dayNumber,
              {
                color: selected ? resident.onAccent : !inMonth ? resident.muted : date === localToday() ? resident.accentText : resident.text,
                opacity: !selected && !inMonth ? 0.5 : 1,
              },
            ]}
          >
            {day}
          </ThemedText>
          <View style={styles.dots}>
            {(eventDateMap[date] ?? []).slice(0, 3).map((color, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: selected ? resident.onAccent : healthTypeColor(
                  DRIVE_TYPES.find((type) => DRIVE_TYPE_CONFIG[type].color === color) ?? 'others', resident,
                ) }]}
              />
            ))}
          </View>
        </View>
      </Pressable>
    );
  };
  const selectedWeekday = parseLocalDate(selectedDate).getDay();
  const headings = (prefix: string) =>
    WEEKDAY_LETTERS.map((day, i) => (
      <View key={`${prefix}-${i}`} style={styles.weekdayColumn}>
        <ThemedText style={[styles.dayLabel, { color: i === selectedWeekday ? resident.accentText : resident.muted }]}>{day}</ThemedText>
      </View>
    ));
  const ready = weekHeight > 0 && monthHeight > 0;
  return (
    <>
      <View style={[styles.calendarFlat, { backgroundColor: resident.accentSoft, borderColor: resident.border }]}>
        <View style={styles.calendar}>
          <Animated.View style={[styles.calendarStack, { height: ready ? boxHeight : weekHeight || undefined }]}>
            <Animated.View
              pointerEvents={showWeek ? 'auto' : 'none'}
              importantForAccessibility={showWeek ? 'auto' : 'no-hide-descendants'}
              style={[styles.calendarLayer, { opacity: swap }]}
              onLayout={(event) => {
                const next = Math.round(event.nativeEvent.layout.height);
                setWeekHeight((previous) => (previous === next ? previous : next));
              }}
            >
              <View style={styles.toolbar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open month and year picker, currently ${MONTH_NAMES[weekMiddle.getMonth()]} ${weekMiddle.getFullYear()}`}
                  onPress={() => setPickerVisible(true)}
                  style={({ pressed }) => [styles.monthButton, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
                >
                  <ThemedText style={[styles.monthTitle, { color: resident.accentText }]}>
                    {MONTH_NAMES[weekMiddle.getMonth()]} {weekMiddle.getFullYear()}{' '}
                    <Ionicons name="chevron-down" size={14} color={resident.accentText} />
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous week"
                  onPress={() => slideWeek(-1)}
                  style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
                >
                  <Ionicons name="chevron-back" size={20} color={resident.accentText} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next week"
                  onPress={() => slideWeek(1)}
                  style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
                >
                  <Ionicons name="chevron-forward" size={20} color={resident.accentText} />
                </Pressable>
              </View>
              <View style={styles.dayGrid}>{headings('week-heading')}</View>
              <View
                style={styles.pager}
                onLayout={(event) => {
                  const next = event.nativeEvent.layout.width;
                  setPagerWidth((previous) => (previous === next ? previous : next));
                }}
                {...swipe.panHandlers}
              >
                <Animated.View
                  style={[
                    styles.pagerTrack,
                    { width: pagerWidth * 3, marginLeft: -pagerWidth, transform: [{ translateX: drag }] },
                  ]}
                >
                  {[-7, 0, 7].map((delta) => {
                    const start = shiftDate(weekStart, delta);
                    return (
                      <View key={start} style={[styles.pagerPage, { width: pagerWidth }]}>
                        {Array.from({ length: 7 }, (_, i) => {
                          const date = shiftDate(start, i);
                          return renderDay(date, parseLocalDate(date).getDate(), true, pagerWidth);
                        })}
                      </View>
                    );
                  })}
                </Animated.View>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Expand to full month calendar"
                accessibilityState={{ expanded: false }}
                onPress={toggleExpanded}
                style={({ pressed }) => [styles.toggleBar, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
              >
                <Ionicons name="chevron-down" size={20} color={resident.accentText} />
              </Pressable>
            </Animated.View>
            <Animated.View
              pointerEvents={showWeek ? 'none' : 'auto'}
              importantForAccessibility={showWeek ? 'no-hide-descendants' : 'auto'}
              style={[styles.calendarLayer, { opacity: monthSwap }]}
              onLayout={(event) => {
                const next = Math.round(event.nativeEvent.layout.height);
                setMonthHeight((previous) => (previous === next ? previous : next));
              }}
            >
              <View style={styles.toolbar}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Open month and year picker, currently ${MONTH_NAMES[month - 1]} ${year}`}
                  onPress={() => setPickerVisible(true)}
                  style={({ pressed }) => [styles.monthButton, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
                >
                  <ThemedText style={[styles.monthTitle, { color: resident.accentText }]}>
                    {MONTH_NAMES[month - 1]} {year}{' '}
                    <Ionicons name="chevron-down" size={14} color={resident.accentText} />
                  </ThemedText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Previous month"
                  onPress={() => onMonthChange(-1)}
                  style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
                >
                  <Ionicons name="chevron-back" size={20} color={resident.accentText} />
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Next month"
                  onPress={() => onMonthChange(1)}
                  style={({ pressed }) => [styles.navButton, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
                >
                  <Ionicons name="chevron-forward" size={20} color={resident.accentText} />
                </Pressable>
              </View>
              <Animated.View
                style={[styles.dayGrid, { opacity: gridOpacity }]}
                onLayout={(event) => {
                  const next = event.nativeEvent.layout.width;
                  setGridWidth((previous) => (previous === next ? previous : next));
                }}
              >
                {headings('heading')}
                {cells.map((cell) => renderDay(cell.date, cell.day, cell.inMonth, gridWidth))}
              </Animated.View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Collapse to week view"
                accessibilityState={{ expanded: true }}
                onPress={toggleExpanded}
                style={({ pressed }) => [styles.toggleBar, { backgroundColor: pressed ? resident.pressed : 'transparent' }]}
              >
                <Ionicons name="chevron-up" size={20} color={resident.accentText} />
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </View>
      <MonthYearPicker
        visible={pickerVisible}
        value={currentMonth}
        onSelect={(y, m) => {
          onJumpTo(y, m);
          if (!expanded) setWeekStart(weekStartOf(`${y}-${pad2(m)}-01`));
        }}
        onClose={() => setPickerVisible(false)}
      />
    </>
  );
}

function RegistrationDetail({
  registration,
  visible,
  onClose,
}: {
  registration: DriveRegistration | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { resident } = useTheme();
  if (!registration) return null;
  const drive = registration.drive;
  const cycle =
    registration.status === 'cancelled'
      ? ['pending', 'confirmed', 'cancelled']
      : ['pending', 'confirmed', 'attended'];
  const current = cycle.indexOf(registration.status);
  const descriptions: Record<string, string> = {
    pending: 'Your application has been received and is awaiting barangay review.',
    confirmed: 'Your slot is confirmed. Please arrive on time on the drive date.',
    attended: 'You have successfully attended this medical drive. Thank you!',
    cancelled: 'This registration has been cancelled.',
  };
  return (
    <HealthSheet
      title={drive?.title ?? 'Medical Drive'}
      visible={visible}
      onClose={onClose}
      footer={<PrimaryButton presentation="resident" label="Close" onPress={onClose} />}
    >
      <ThemedText style={styles.subheading}>Registration info</ThemedText>
      <HealthPanel>
        <View style={styles.row}>
          <ThemedText style={[styles.small, { color: resident.muted }]}>Applicant Number</ThemedText>
          <ThemedText style={[styles.applicantNumber, { color: resident.accentText }]}>
            {registration.applicant_number}
          </ThemedText>
        </View>
        {registration.created_at ? (
          <HealthFact
            label="Registered on"
            value={new Date(registration.created_at).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          />
        ) : null}
        <HealthFact label="PWD" value={registration.is_pwd ? 'Yes' : 'No'} />
        <HealthFact label="Age at Registration" value={`${registration.age} yrs`} />
      </HealthPanel>
      {drive ? (
        <>
          <ThemedText style={styles.subheading}>Drive details</ThemedText>
          <HealthPanel>
            <HealthFact label="Date" value={healthDate(drive.drive_date, true)} />
            <HealthFact
              label="Time"
              value={`${healthTime(drive.time_start)}–${healthTime(drive.time_end)}`}
            />
            <HealthFact label="Location" value={drive.location} />
            <HealthFact label="Eligible For" value={drive.eligible_criteria} />
            <HealthFact
              label={drive.stock_label}
              value={`${drive.stock_remaining}/${drive.stock_total} ${drive.stock_unit}`}
            />
            <View style={{ height: 6, marginHorizontal: 16, marginBottom: 16 }}>
              <ProgressBar
                presentation="resident"
                color={resident.accent}
                fraction={drive.stock_total > 0 ? drive.stock_remaining / drive.stock_total : 0}
              />
            </View>
          </HealthPanel>
        </>
      ) : (
        <ThemedText style={{ color: resident.muted }}>Drive details are unavailable.</ThemedText>
      )}
      <ThemedText style={styles.subheading}>Status timeline</ThemedText>
      <HealthPanel>
        <View style={styles.timeline}>
          {current < 0 ? (
            <HealthStatus status={registration.status} />
          ) : (
            cycle.map((status, i) => (
              <View key={status} style={styles.step}>
                <View style={styles.stepLeft}>
                  <View
                    style={[
                      styles.stepIcon,
                      {
                        borderColor: i <= current ? resident.accentText : resident.border,
                        backgroundColor: i <= current ? resident.accentSoft : resident.surface,
                      },
                    ]}
                  >
                    <Ionicons
                      name={
                        i < current
                          ? 'checkmark'
                          : status === 'cancelled'
                            ? 'close'
                            : status === 'attended'
                              ? 'ribbon-outline'
                              : status === 'confirmed'
                                ? 'checkmark-circle-outline'
                                : 'time-outline'
                      }
                      size={16}
                      color={i <= current ? resident.accentText : resident.muted}
                    />
                  </View>
                  {i < cycle.length - 1 ? (
                    <View
                      style={[
                        styles.stepConnector,
                        { backgroundColor: i < current ? resident.accentText : resident.border },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <HealthStatus status={status} />
                  {i === current ? (
                    <ThemedText style={[styles.small, { color: resident.accentText }]}>Current</ThemedText>
                  ) : null}
                  <ThemedText style={[styles.small, { color: resident.muted }]}>
                    {descriptions[status]}
                  </ThemedText>
                </View>
              </View>
            ))
          )}
        </View>
      </HealthPanel>
    </HealthSheet>
  );
}

function MyRegistrationsPanel({
  registrations,
  hasLoaded,
  loading,
  refreshing,
  error,
  onRetry,
  onRefresh,
}: {
  registrations: DriveRegistration[];
  hasLoaded: boolean;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  onRetry: () => void;
  onRefresh: () => unknown;
}) {
  const { resident } = useTheme();
  const inset = useFloatingTabInset();
  const pull = usePullRefresh([onRefresh]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const [detailId, setDetailId] = useState<string | null>(null);
  // Keep the last content through exit while reading current server status on refresh.
  const [lastDetail, setLastDetail] = useState<DriveRegistration | null>(null);
  const detail = registrations.find((reg) => reg.id === detailId) ?? lastDetail;
  const filtered = status === 'all' ? registrations : registrations.filter((reg) => reg.status === status);
  const colors: Record<StatusFilter, string> = {
    all: resident.accentText,
    pending: resident.warning,
    confirmed: resident.accentText,
    attended: resident.info,
    cancelled: resident.danger,
  };
  return (
    <>
      <View style={styles.registrationFilters}>
        <FilterChips
          compact
          active={status}
          onSelect={setStatus}
          chips={STATUSES.map((key) => ({
            key,
            label: key[0].toUpperCase() + key.slice(1),
            color: colors[key],
          }))}
        />
      </View>
      <ScrollView
        refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
        contentContainerStyle={[styles.content, { paddingBottom: inset + 16 }]}>
        <ThemedText accessibilityRole="header" style={styles.heading}>
          My applications
        </ThemedText>
        {error ? (
          <View style={styles.empty}>
            <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>
              {error}
            </ThemedText>
            <PrimaryButton presentation="resident" label="Retry registrations" onPress={onRetry} />
          </View>
        ) : null}
        {refreshing ? <ThemedText accessibilityLiveRegion="polite" style={{ color: resident.muted }}>Refreshing registrations…</ThemedText> : null}
        {loading ? (
          <ActivityIndicator color={resident.accentText} />
        ) : filtered.length === 0 && error && !hasLoaded ? null : filtered.length === 0 ? (
          <ThemedText style={[styles.empty, { color: resident.muted }]}>
            {registrations.length === 0
              ? "You haven't registered for any medical drives yet."
              : `No ${status} registrations found.`}
          </ThemedText>
        ) : (
          <HealthPanel>
            {filtered.map((reg, i) => (
              <Pressable
                key={reg.id}
                accessibilityRole="button"
                accessibilityLabel={`View details for ${reg.drive?.title ?? 'registration'}`}
                onPress={() => {
                  setLastDetail(reg);
                  setDetailId(reg.id);
                }}
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderTopWidth: i ? 1 : 0,
                    borderColor: resident.border,
                    backgroundColor: pressed ? resident.pressed : resident.card,
                  },
                ]}
              >
                <ThemedText style={styles.subheading}>{reg.drive?.title ?? 'Medical Drive'}</ThemedText>
                {reg.drive ? (
                  <ThemedText style={[styles.small, { color: resident.muted }]}>
                    {healthDate(reg.drive.drive_date)} · {healthTime(reg.drive.time_start)}–
                    {healthTime(reg.drive.time_end)} · {reg.drive.location}
                  </ThemedText>
                ) : null}
                <View style={styles.applicationBottom}>
                  <ThemedText style={[styles.small, { color: resident.accentText, flex: 1 }]}>
                    {reg.applicant_number}
                  </ThemedText>
                  <HealthStatus status={reg.status} />
                  <Ionicons name="chevron-forward" size={16} color={resident.muted} />
                </View>
              </Pressable>
            ))}
          </HealthPanel>
        )}
      </ScrollView>
      <RegistrationDetail
        registration={detail}
        visible={detailId !== null}
        onClose={() => setDetailId(null)}
      />
    </>
  );
}

export default function HealthScreen() {
  const { resident } = useTheme();
  const bottomTabInset = useFloatingTabInset();
  const { session } = useAuth();
  const [requestedSegment, setSegment] = useState<HealthSegment>('active-drives');
  const segment = !session ? 'active-drives' : requestedSegment;
  const [selectedDate, setSelectedDate] = useState(localToday);
  const [typeFilter, setTypeFilter] = useState<DriveType | 'all'>('all');
  const [monthViewActive, setMonthViewActive] = useState(false);
  const [showCalendar, setShowCalendar] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const t = new Date();
    return { year: t.getFullYear(), month: t.getMonth() + 1 };
  });
  const {
    drives,
    hasLoadedDrives,
    loadingDrives,
    refreshingDrives,
    monthEventMap,
    calendarError,
    refetchCalendar,
    monthDrives,
    hasLoadedMonthDrives,
    loadingMonthDrives,
    refreshingMonthDrives,
    fetchMonthDrives,
    myRegistrations,
    hasLoadedRegistrations,
    loadingRegistrations,
    refreshingRegistrations,
    registeredDriveIds,
    error,
    monthError,
    registrationsError,
    refetch,
    refetchRegistrations,
  } = useMedicalDrives({ selectedDate, typeFilter, calendarMonth: currentMonth, monthViewActive });
  const { searchDate } = useLocalSearchParams<{ searchDate?: string }>();
  useEffect(() => {
    if (!searchDate || !/^\d{4}-\d{2}-\d{2}$/.test(searchDate)) return;
    const date = parseLocalDate(searchDate);
    if (Number.isNaN(date.getTime())) return;
    setSelectedDate(searchDate);
    setCurrentMonth({ year: date.getFullYear(), month: date.getMonth() + 1 });
    setMonthViewActive(false);
    setTypeFilter('all');
    setSegment('active-drives');
    router.setParams({ searchDate: undefined });
  }, [searchDate]);
  const handleMonthChange = (delta: 1 | -1) =>
    setCurrentMonth((prev) => {
      let m = prev.month + delta,
        y = prev.year;
      if (m > 12) {
        m = 1;
        y++;
      }
      if (m < 1) {
        m = 12;
        y--;
      }
      return { year: y, month: m };
    });
  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
    setMonthViewActive(false);
    const d = parseLocalDate(date);
    setCurrentMonth({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };
  const handleRegister = (drive: MedicalDrive) => {
    if (!session) {
      Alert.alert('Sign In Required', 'Please log in to register for a medical drive.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Log In', onPress: () => router.push('/(auth)/login') },
      ]);
      return;
    }
    router.push({ pathname: '/(app)/health/register', params: { driveId: drive.id } });
  };
  const activeDrives = monthViewActive ? monthDrives : drives;
  const loading = monthViewActive ? loadingMonthDrives : loadingDrives;
  const hasLoaded = monthViewActive ? hasLoadedMonthDrives : hasLoadedDrives;
  const refreshing = monthViewActive ? refreshingMonthDrives : refreshingDrives;
  const pull = usePullRefresh(monthViewActive ? [fetchMonthDrives, refetchCalendar] : [refetch, refetchCalendar]);
  const activeError = monthViewActive ? monthError : error;
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: resident.card }]}>
      {session ? (
        <SegmentedControl
          compact
          presentation="resident"
          variant="underline"
          segments={[
            { key: 'active-drives', label: 'Active Medical Drives' },
            { key: 'my-registrations', label: 'My Registrations' },
          ]}
          activeKey={segment}
          onChange={setSegment}
        />
      ) : null}
      {segment === 'active-drives' ? (
        <ScrollView
          refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
          contentContainerStyle={[styles.content, { paddingBottom: bottomTabInset + 16 }]}
          keyboardShouldPersistTaps="handled"
        >
          {showCalendar ? (
            <DriveCalendar
              selectedDate={selectedDate}
              onDateSelect={handleDateSelect}
              eventDateMap={monthEventMap}
              currentMonth={currentMonth}
              onMonthChange={handleMonthChange}
              onJumpTo={(year, month) => setCurrentMonth({ year, month })}
            />
          ) : null}
          {calendarError ? <View style={styles.empty}>
            <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>{calendarError}</ThemedText>
            <PrimaryButton presentation="resident" variant="secondary" label="Retry calendar" onPress={() => { void refetchCalendar(); }} />
          </View> : null}
          <View style={styles.filters}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showCalendar ? 'Hide calendar' : 'Show calendar'}
              accessibilityState={{ selected: showCalendar }}
              onPress={() => setShowCalendar((v) => !v)}
              style={({ pressed }) => [
                styles.iconButton,
                { backgroundColor: pressed ? resident.pressed : showCalendar ? resident.accentSoft : resident.surface, borderRadius: 12 },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={resident.accentText} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <FilterChips
                compact
                active={typeFilter}
                onSelect={setTypeFilter}
                chips={[
                  { key: 'all', label: 'All', color: resident.accentText },
                  ...DRIVE_TYPES.map((key) => ({
                    key,
                    label: DRIVE_TYPE_CONFIG[key].label,
                    color: healthTypeColor(key, resident),
                  })),
                ]}
              />
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: monthViewActive }}
            accessibilityLabel={`Show all drives for ${MONTH_NAMES[currentMonth.month - 1]}`}
            onPress={() => setMonthViewActive((v) => !v)}
            style={({ pressed }) => [
              styles.monthToggle,
              { backgroundColor: pressed ? resident.pressed : monthViewActive ? resident.accentSoft : resident.surface,
                borderColor: monthViewActive ? resident.accentText : resident.border },
            ]}
          >
            <Ionicons name={monthViewActive ? 'checkmark-circle' : 'calendar-outline'} size={16} color={resident.accentText} />
            <ThemedText style={[styles.small, { color: resident.accentText }]}>
              All drives for {MONTH_NAMES[currentMonth.month - 1]}{' '}
              {currentMonth.year}
            </ThemedText>
          </Pressable>
          <View style={styles.sectionHeader}>
            <ThemedText accessibilityRole="header" style={styles.heading}>
              Medical drives
            </ThemedText>
            <ThemedText style={[styles.small, { color: resident.muted }]}>
              {monthViewActive
                ? `${MONTH_NAMES[currentMonth.month - 1]} ${currentMonth.year}`
                : healthDate(selectedDate, true)}
            </ThemedText>
          </View>
          {activeError ? (
            <View style={styles.empty}>
              <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>
                {activeError}
              </ThemedText>
              <PrimaryButton
                presentation="resident"
                label="Retry drives"
                onPress={() => {
                  void (monthViewActive
                    ? fetchMonthDrives()
                    : refetch());
                }}
              />
            </View>
          ) : null}
          {refreshing ? <ThemedText accessibilityLiveRegion="polite" style={{ color: resident.muted }}>Refreshing medical drives…</ThemedText> : null}
          {loading ? (
            <ActivityIndicator color={resident.accentText} />
          ) : activeDrives.length === 0 && activeError && !hasLoaded ? null : activeDrives.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: resident.surface, borderColor: resident.border }]}>
              <View style={[styles.emptyIcon, { backgroundColor: resident.accentSoft }]}>
                <Ionicons name="calendar-clear-outline" size={22} color={resident.accentText} />
              </View>
              <ThemedText style={[styles.emptyText, { color: resident.muted }]}>
                {monthViewActive
                  ? `No active medical drives in ${MONTH_NAMES[currentMonth.month - 1]}`
                  : 'No medical drives on this date'}
                {typeFilter !== 'all' ? ` for ${DRIVE_TYPE_CONFIG[typeFilter].label}` : ''}.
              </ThemedText>
            </View>
          ) : (
            <HealthPanel>
              {activeDrives.map((drive, i) => (
                <View key={drive.id} style={{ borderTopWidth: i ? 1 : 0, borderColor: resident.border }}>
                  <HealthDriveSummary
                    drive={drive}
                    registered={registeredDriveIds.has(drive.id)}
                    onRegister={() => handleRegister(drive)}
                  />
                </View>
              ))}
            </HealthPanel>
          )}
        </ScrollView>
      ) : (
        <MyRegistrationsPanel
          registrations={myRegistrations}
          hasLoaded={hasLoadedRegistrations}
          loading={loadingRegistrations}
          refreshing={refreshingRegistrations}
          error={registrationsError}
          onRetry={() => {
            void refetchRegistrations();
          }}
          onRefresh={refetchRegistrations}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 14, gap: 10 },
  heading: { fontSize: 19, lineHeight: 25, fontWeight: '800' },
  subheading: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  small: { fontSize: 13.5, lineHeight: 20 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  registrationFilters: { paddingHorizontal: 14, paddingTop: 10 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  calendar: { paddingTop: 0 },
  calendarFlat: { borderBottomWidth: 1, marginHorizontal: -14, marginTop: -14, paddingHorizontal: 14, paddingTop: 6 },
  navButton: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  toggleBar: { height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  calendarStack: { overflow: 'hidden' },
  calendarLayer: { position: 'absolute', top: 0, left: 0, right: 0 },
  pager: { overflow: 'hidden' },
  pagerTrack: { flexDirection: 'row' },
  pagerPage: { flexDirection: 'row' },
  monthButton: { flex: 1, minHeight: 36, justifyContent: 'center', paddingHorizontal: 4, borderRadius: 10 },
  monthArrow: { borderRadius: 12 },
  monthTitle: { fontSize: 16, lineHeight: 22, fontWeight: '800' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 2 },
  weekdayColumn: { width: '14.285714%', minHeight: 20, justifyContent: 'center', alignItems: 'center' },
  dayColumn: { width: '14.285714%', minHeight: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  dayLabel: { fontSize: 12, lineHeight: 16, fontWeight: '800' },
  dayCircle: {
    width: 32,
    minHeight: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayNumber: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  dots: { position: 'absolute', bottom: 2, flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  monthToggle: { minHeight: 44, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1 },
  sectionHeader: { gap: 2, paddingTop: 2 },
  emptyState: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, borderWidth: 1, borderRadius: 16 },
  emptyIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  emptyText: { flex: 1, fontSize: 13.5, lineHeight: 20 },
  empty: { padding: 20, gap: 12, textAlign: 'center' },
  row: { padding: 16, gap: 8 },
  applicationBottom: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  applicantNumber: { fontSize: 21, lineHeight: 28, fontWeight: '800' },
  timeline: { padding: 16 },
  step: { flexDirection: 'row', gap: 12, paddingBottom: 16 },
  stepLeft: { alignItems: 'center' },
  stepConnector: { flex: 1, width: 2, marginTop: 4, minHeight: 12 },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerFooter: { flexDirection: 'row', gap: 12 },
  wheels: { flexDirection: 'row', height: PICKER_ROW * PICKER_ROWS, position: 'relative' },
  wheelSelection: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: PICKER_ROW * 2,
    height: PICKER_ROW,
    borderRadius: 12,
  },
});
