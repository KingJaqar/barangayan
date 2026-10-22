import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, View } from 'react-native';

import { AlertDatePicker } from '@/components/drrm/alert-date-picker';
import { DrrmDisclosure } from '@/components/drrm/disclosure';
import { DrrmSourceState, OfflineBadge, drrmStyles } from '@/components/drrm/presentation';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { ThemedText } from '@/components/themed-text';
import type { EmergencyAnnouncement } from '@/hooks/use-emergency-announcements';
import { useTheme } from '@/hooks/use-theme';
import { ALERT_PERIODS, EMPTY_ALERT_DATE, alertDateLabel, matchesEmergencyAlert, type AlertDateFilter, type AlertPeriod } from '@/lib/emergency-alert-filter';

export function AlertsContent({ alerts, isLoading, error, isOffline, refetch }: {
  alerts: EmergencyAnnouncement[];
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;
  refetch: () => void;
}) {
  const { resident } = useTheme();
  const [period, setPeriod] = useState<AlertPeriod>('all');
  const [date, setDate] = useState<AlertDateFilter>(EMPTY_ALERT_DATE);
  const [draft, setDraft] = useState<AlertDateFilter>(EMPTY_ALERT_DATE);
  const [pickerOpen, setPickerOpen] = useState(false);
  const filtered = useMemo(() => alerts.filter(alert => matchesEmergencyAlert(alert.published_at, period, date, new Date())), [alerts, period, date]);
  const hasDate = Boolean(date.month || date.day || date.year);
  function clear() { Keyboard.dismiss(); setDate(EMPTY_ALERT_DATE); setDraft(EMPTY_ALERT_DATE); setPickerOpen(false); }

  return <View>
    <View style={styles.headingRow}>
      <View style={[drrmStyles.tile, { backgroundColor: resident.dangerSoft }]}>
        <Ionicons name="warning-outline" size={20} color={resident.danger} accessible={false} />
      </View>
      <ThemedText accessibilityRole="header" style={[styles.heading, { color: resident.text }]}>Emergency Alerts</ThemedText>
      {!isLoading || alerts.length ? <View style={[styles.count, { backgroundColor: resident.surface }]}>
        <ThemedText accessibilityLabel={`${alerts.length} total alerts`} style={[styles.countText, { color: resident.text }]}>{alerts.length}</ThemedText>
      </View> : null}
    </View>
    <ScrollableChevronRow label="alert periods" contentContainerStyle={styles.periods}>
      {ALERT_PERIODS.map(option => <Pressable key={option.key} accessibilityRole="button" accessibilityLabel={option.label}
        accessibilityState={{ selected: period === option.key }} onPress={() => setPeriod(option.key)}
        style={({ pressed }) => [styles.period, { backgroundColor: pressed ? resident.pressed : period === option.key ? resident.accent : resident.surface,
          borderColor: period === option.key && resident.accentNeedsOutline ? resident.controlBorder : 'transparent' }]}>
        {({ pressed }) => <ThemedText style={[styles.periodText, { color: pressed || period !== option.key ? resident.text : resident.onAccent }]}>{option.label}</ThemedText>}
      </Pressable>)}
    </ScrollableChevronRow>
    <DrrmDisclosure open={pickerOpen} onToggle={() => {
      if (!pickerOpen) setDraft(date);
      else Keyboard.dismiss();
      setPickerOpen(previous => !previous);
    }} label="Filter by specific date" headerStyle={styles.dateToggle}
      header={<><Ionicons name="calendar-outline" size={16} color={resident.accentText} accessible={false} />
        <ThemedText style={[styles.dateText, { color: resident.text }]}>Filter by specific date</ThemedText></>}>
      <AlertDatePicker value={draft} active={pickerOpen} onChange={setDraft} onClear={clear}
        onApply={() => { Keyboard.dismiss(); setDate(draft); setPickerOpen(false); }} />
    </DrrmDisclosure>
    {hasDate && !pickerOpen ? <Pressable accessibilityRole="button" accessibilityLabel="Clear date filter" onPress={clear}
      style={[styles.applied, { backgroundColor: resident.accentSoft, borderColor: resident.border }]}>
      <ThemedText style={[styles.appliedText, { color: resident.accentText }]}>{alertDateLabel(date)}</ThemedText>
      <Ionicons name="close" size={18} color={resident.accentText} accessible={false} />
    </Pressable> : null}
    <View style={styles.summary}>
      <ThemedText accessibilityLiveRegion="polite" style={[styles.summaryText, { color: resident.muted }]}>Showing {filtered.length} of {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}</ThemedText>
      {isOffline ? <OfflineBadge /> : null}
    </View>
    {error ? <View style={styles.feedback}><DrrmSourceState message={alerts.length ? 'Unable to refresh alerts. Showing available offline alerts.' : 'Unable to load alerts.'} retry={refetch} /></View> : null}
    {alerts.length === 0 ? isLoading ? <DrrmSourceState loading message="Loading emergency alerts…" /> : !error ? <DrrmSourceState message="No emergency alerts at this time." /> : null
      : filtered.length === 0 ? <DrrmSourceState message="No emergency alerts match your filter." />
        : <View style={[drrmStyles.group, { borderColor: resident.border, backgroundColor: resident.card }]}>
          {filtered.map((alert, index) => <View key={alert.id} style={[styles.alertRow, index > 0 && { borderTopWidth: 1, borderTopColor: resident.border }]}>
            <View style={[drrmStyles.tile, { backgroundColor: resident.dangerSoft }]}>
              <Ionicons name="alert-circle-outline" size={20} color={resident.danger} accessible={false} />
            </View>
            <View style={styles.alertBody}>
              <View style={styles.meta}>
                <View style={[styles.badge, { backgroundColor: resident.danger }]}><ThemedText style={[styles.badgeText, { color: resident.onDanger }]}>EMERGENCY</ThemedText></View>
                <ThemedText style={[styles.timestamp, { color: resident.muted }]}>{formatAlertDateTime(alert.published_at)}</ThemedText>
              </View>
              <ThemedText style={[styles.alertTitle, { color: resident.text }]}>{alert.title}</ThemedText>
              <ThemedText style={[styles.alertText, { color: resident.muted }]}>{alert.body}</ThemedText>
            </View>
          </View>)}
        </View>}
  </View>;
}

function formatAlertDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  const month = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][date.getMonth()];
  return `${month} ${date.getDate()}, ${date.getFullYear()} · ${date.getHours() % 12 || 12}:${String(date.getMinutes()).padStart(2, '0')} ${date.getHours() >= 12 ? 'PM' : 'AM'}`;
}

const styles = StyleSheet.create({
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1, minWidth: 0, fontSize: 20, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },
  count: { minWidth: 28, minHeight: 28, paddingHorizontal: 8, borderRadius: 100, alignItems: 'center', justifyContent: 'center' },
  countText: { fontSize: 13, lineHeight: 20, fontWeight: '700' },
  periods: { flexDirection: 'row', gap: 6, paddingTop: 8, paddingBottom: 0 },
  period: { minHeight: 44, borderRadius: 100, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 6, justifyContent: 'center' },
  periodText: { fontSize: 13, lineHeight: 20, fontWeight: '600' },
  dateToggle: { alignSelf: 'flex-start', gap: 6, borderRadius: 12 },
  dateText: { flexShrink: 1, fontSize: 13.5, lineHeight: 20, fontWeight: '600' },
  applied: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, borderRadius: 100, borderWidth: 1, paddingHorizontal: 12, gap: 8 },
  appliedText: { flexShrink: 1, fontSize: 12.5, lineHeight: 19, fontWeight: '700' },
  summary: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 6, marginBottom: 8 },
  summaryText: { fontSize: 13, lineHeight: 19 },
  feedback: { marginBottom: 12 },
  alertRow: { flexDirection: 'row', alignItems: 'flex-start', padding: 12, gap: 10 },
  alertBody: { flex: 1, minWidth: 0 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badge: { borderRadius: 100, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10.5, lineHeight: 15, fontWeight: '700', letterSpacing: 0.3 },
  timestamp: { fontSize: 12, lineHeight: 17 },
  alertTitle: { marginTop: 6, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  alertText: { marginTop: 2, fontSize: 13, lineHeight: 18 },
});
