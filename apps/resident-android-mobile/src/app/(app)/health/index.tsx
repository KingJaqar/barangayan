import { DRIVE_TYPES, DRIVE_TYPE_CONFIG } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FilterChips } from '@/components/filter-chips';
import {
  HealthDriveSummary,
  HealthFact,
  HealthPanel,
  HealthSheet,
  HealthStatus,
  healthDate,
  healthTime,
} from '@/components/health/health-presentation';
import { PrimaryButton } from '@/components/primary-button';
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
  const [year, setYear] = useState(value.year);
  useEffect(() => {
    if (visible) setYear(value.year);
  }, [visible, value.year]);
  const today = new Date();
  const min = today.getFullYear() - 1,
    max = today.getFullYear() + 5;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.dialogOverlay}>
        <Pressable
          accessibilityLabel="Dismiss month and year picker"
          accessibilityRole="button"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim }]}
        />
        <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: resident.card }]}>
          <ThemedText accessibilityRole="header" style={styles.subheading}>
            Select Month &amp; Year
          </ThemedText>
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Previous year"
              disabled={year <= min}
              onPress={() => setYear((y) => Math.max(min, y - 1))}
              style={styles.iconButton}
            >
              <Ionicons name="chevron-back" size={20} color={year <= min ? resident.muted : resident.text} />
            </Pressable>
            <ThemedText style={styles.subheading}>{year}</ThemedText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Next year"
              disabled={year >= max}
              onPress={() => setYear((y) => Math.min(max, y + 1))}
              style={styles.iconButton}
            >
              <Ionicons
                name="chevron-forward"
                size={20}
                color={year >= max ? resident.muted : resident.text}
              />
            </Pressable>
          </View>
          <View style={styles.monthGrid}>
            {MONTH_NAMES.map((label, i) => {
              const selected = year === value.year && i + 1 === value.month;
              return (
                <Pressable
                  key={label}
                  accessibilityRole="button"
                  accessibilityLabel={`${label} ${year}`}
                  accessibilityState={{ selected }}
                  onPress={() => {
                    onSelect(year, i + 1);
                    onClose();
                  }}
                  style={[
                    styles.monthCell,
                    {
                      backgroundColor: selected ? resident.accent : resident.surface,
                      borderColor:
                        selected && resident.accentNeedsOutline ? resident.controlBorder : 'transparent',
                    },
                  ]}
                >
                  <ThemedText style={{ color: selected ? resident.onAccent : resident.text, fontSize: 13 }}>
                    {label.slice(0, 3)}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          <PrimaryButton presentation="resident" label="Close" variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

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
  return (
    <HealthPanel>
      <View style={styles.calendar}>
        <View style={styles.toolbar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open month and year picker, currently ${MONTH_NAMES[month - 1]} ${year}`}
            onPress={() => setPickerVisible(true)}
            style={{ flex: 1 }}
          >
            <ThemedText style={styles.monthTitle}>
              {MONTH_NAMES[month - 1]} {year}{' '}
              <Ionicons name="chevron-down" size={12} color={resident.muted} />
            </ThemedText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Previous month"
            onPress={() => onMonthChange(-1)}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-back" size={20} color={resident.text} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Next month"
            onPress={() => onMonthChange(1)}
            style={styles.iconButton}
          >
            <Ionicons name="chevron-forward" size={20} color={resident.text} />
          </Pressable>
        </View>
        <View
          style={styles.dayGrid}
          onLayout={(event) => {
            const next = event.nativeEvent.layout.width;
            setGridWidth((previous) => (previous === next ? previous : next));
          }}
        >
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
            <View key={`heading-${i}`} style={styles.dayColumn}>
              <ThemedText style={[styles.dayLabel, { color: resident.muted }]}>{day}</ThemedText>
            </View>
          ))}
          {cells.map((cell) => {
            const selected = cell.date === selectedDate;
            return (
              <Pressable
                key={cell.date}
                accessibilityRole="button"
                accessibilityLabel={healthDate(cell.date, true)}
                accessibilityState={{ selected }}
                onPress={() => onDateSelect(cell.date)}
                style={styles.dayColumn}
              >
                <View
                  style={[
                    styles.dayCircle,
                    {
                      width: Math.min(40, gridWidth / 7),
                      backgroundColor: selected ? resident.accent : 'transparent',
                      borderColor:
                        selected && resident.accentNeedsOutline
                          ? resident.controlBorder
                          : !selected && cell.date === localToday()
                            ? resident.accentText
                            : 'transparent',
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.dayNumber,
                      {
                        color: selected ? resident.onAccent : cell.inMonth ? resident.text : resident.muted,
                        opacity: !selected && !cell.inMonth ? 0.5 : 1,
                      },
                    ]}
                  >
                    {cell.day}
                  </ThemedText>
                  <View style={styles.dots}>
                    {(eventDateMap[cell.date] ?? []).slice(0, 3).map((color, i) => (
                      <View
                        key={i}
                        style={[styles.dot, { backgroundColor: selected ? resident.onAccent : color }]}
                      />
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>
      <MonthYearPicker
        visible={pickerVisible}
        value={currentMonth}
        onSelect={onJumpTo}
        onClose={() => setPickerVisible(false)}
      />
    </HealthPanel>
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
  loading,
  error,
  onRetry,
}: {
  registrations: DriveRegistration[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const { resident } = useTheme();
  const inset = useFloatingTabInset();
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
      <FilterChips
        active={status}
        onSelect={setStatus}
        chips={STATUSES.map((key) => ({
          key,
          label: key[0].toUpperCase() + key.slice(1),
          color: colors[key],
        }))}
      />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: inset + 40 }]}>
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
        {loading ? (
          <ActivityIndicator color={resident.accentText} />
        ) : filtered.length === 0 && error ? null : filtered.length === 0 ? (
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
    loadingDrives,
    monthEventMap,
    fetchMonthEventDates,
    monthDrives,
    loadingMonthDrives,
    fetchMonthDrives,
    myRegistrations,
    loadingRegistrations,
    registeredDriveIds,
    error,
    monthError,
    registrationsError,
    refetch,
    refetchRegistrations,
  } = useMedicalDrives({ selectedDate, typeFilter });
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
  useEffect(() => {
    void fetchMonthEventDates(currentMonth.year, currentMonth.month);
  }, [currentMonth, fetchMonthEventDates]);
  useEffect(() => {
    if (monthViewActive) void fetchMonthDrives(currentMonth.year, currentMonth.month);
  }, [currentMonth, fetchMonthDrives, monthViewActive]);
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
  const activeError = monthViewActive ? monthError : error;
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.root, { backgroundColor: resident.card }]}>
      {session ? (
        <SegmentedControl
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
          contentContainerStyle={[styles.content, { paddingBottom: bottomTabInset + 40 }]}
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
          <View style={styles.toolbar}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showCalendar ? 'Hide calendar' : 'Show calendar'}
              accessibilityState={{ selected: showCalendar }}
              onPress={() => setShowCalendar((v) => !v)}
              style={[
                styles.iconButton,
                { backgroundColor: showCalendar ? resident.accentSoft : resident.surface, borderRadius: 22 },
              ]}
            >
              <Ionicons name="calendar-outline" size={18} color={resident.accentText} />
            </Pressable>
            <View style={{ flex: 1, minWidth: 0 }}>
              <FilterChips
                active={typeFilter}
                onSelect={setTypeFilter}
                chips={[
                  { key: 'all', label: 'All', color: resident.accentText },
                  ...DRIVE_TYPES.map((key) => ({
                    key,
                    label: DRIVE_TYPE_CONFIG[key].label,
                    color: DRIVE_TYPE_CONFIG[key].color,
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
            style={[
              styles.monthToggle,
              { backgroundColor: monthViewActive ? resident.accentSoft : resident.surface },
            ]}
          >
            <ThemedText style={[styles.small, { color: resident.accentText }]}>
              {monthViewActive ? '✓ ' : ''}All drives for {MONTH_NAMES[currentMonth.month - 1]}{' '}
              {currentMonth.year}
            </ThemedText>
          </Pressable>
          <View>
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
                    ? fetchMonthDrives(currentMonth.year, currentMonth.month)
                    : refetch());
                }}
              />
            </View>
          ) : null}
          {loading ? (
            <ActivityIndicator color={resident.accentText} />
          ) : activeDrives.length === 0 && activeError ? null : activeDrives.length === 0 ? (
            <ThemedText style={[styles.empty, { color: resident.muted }]}>
              {monthViewActive
                ? `No active medical drives in ${MONTH_NAMES[currentMonth.month - 1]}`
                : 'No medical drives on this date'}
              {typeFilter !== 'all' ? ` for ${DRIVE_TYPE_CONFIG[typeFilter].label}` : ''}.
            </ThemedText>
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
          loading={loadingRegistrations}
          error={registrationsError}
          onRetry={() => {
            void refetchRegistrations();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 20, gap: 12 },
  heading: { fontSize: 21, lineHeight: 28, fontWeight: '800' },
  subheading: { fontSize: 15, lineHeight: 22, fontWeight: '700' },
  small: { fontSize: 13.5, lineHeight: 20 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  calendar: { padding: 16 },
  monthTitle: { fontSize: 17, lineHeight: 24, fontWeight: '800' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  dayColumn: { width: '14.285714%', minHeight: 42, justifyContent: 'center', alignItems: 'center' },
  dayLabel: { fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  dayCircle: {
    width: 40,
    minHeight: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  dayNumber: { fontSize: 14, lineHeight: 22, fontWeight: '600' },
  dots: { position: 'absolute', bottom: 3, flexDirection: 'row', gap: 2 },
  dot: { width: 4, height: 4, borderRadius: 2 },
  monthToggle: { minHeight: 44, borderRadius: 12, padding: 10, justifyContent: 'center' },
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
  dialogOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  dialog: { width: '100%', maxWidth: 360, borderRadius: 24, padding: 20, gap: 16 },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  monthCell: {
    width: '22%',
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    borderWidth: 1,
  },
});
