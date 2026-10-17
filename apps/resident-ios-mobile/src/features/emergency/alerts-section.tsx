import { formatDateTime } from '@barangayan/shared';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, Pressable, View } from 'react-native';
import { ResourceList } from '../../components/resource-list';
import { Action, Body, Card, Destination, Field, Notice, Segmented, StatusBadge, SymbolIcon } from '../../components/ui';
import { useReportCounts } from '../../data/report-counts';
import { useApi } from '../../data/use-api';
import { usePagedResource } from '../../data/use-paged-resource';
import { useResource } from '../../data/use-resource';
import { announcementPreview } from '../reports/media';
import { useReadActions } from '../reports/use-read-actions';
import { useResident } from '../../lib/runtime';
import { layout, space, useColors } from '../../lib/theme';
import { formatRelativeTime } from '../../lib/format';
import {
  ALERT_PERIOD_OPTIONS, activeCustomCount, buildAlertQuery, parseCustom, sanitizeDigits, sanitizeLetters,
  type AlertPeriod, type CustomInput,
} from './alert-filters';
import { alertCounts, alertsRead } from './alerts-read';

const NO_INPUT: CustomInput = { month: '', day: '', year: '' };

const dayKey = (now: Date) => `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

/** The current instant, renewed when the app returns to the foreground on a new local calendar day so "Today" never goes stale. */
function useLocalClock(): { day: string; now: Date } {
  const [clock, setClock] = useState(() => { const now = new Date(); return { day: dayKey(now), now }; });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      const now = new Date();
      setClock((previous) => previous.day === dayKey(now) ? previous : { day: dayKey(now), now });
    });
    return () => subscription.remove();
  }, []);
  return clock;
}

/**
 * Emergency alerts (A28): the barangay's emergency-category announcements with period and custom
 * month/day/year filters, an exact count, and the same individual read state as announcements.
 * `header` carries the hub's section strip so it scrolls with the list.
 */
export function AlertsSection({ header }: { header: ReactNode }) {
  const api = useApi();
  const colors = useColors();
  const { session, config } = useResident();
  const { refresh: refreshCounts } = useReportCounts();
  const owner = session?.user.id;
  const { day, now } = useLocalClock();
  const [period, setPeriod] = useState<AlertPeriod>('all');
  const [input, setInput] = useState<CustomInput>(NO_INPUT);
  const [rejected, setRejected] = useState<Partial<Record<keyof CustomInput, string>>>({});
  const [customOpen, setCustomOpen] = useState(false);

  const { filter, errors } = useMemo(() => parseCustom(input), [input]);
  const invalid = Object.keys(errors).length > 0;
  const { month, day: dayOfMonth, year } = filter;
  const query = useMemo(() => buildAlertQuery(period, { month, day: dayOfMonth, year }, now), [period, month, dayOfMonth, year, now]);
  const effective = invalid ? { ...query, empty: true } : query;
  const key = `${period}:${month ?? ''}:${dayOfMonth ?? ''}:${year ?? ''}:${invalid ? 'invalid' : day}`;
  const filtered = period !== 'all' || activeCustomCount(input) > 0;

  const sources = [{ table: 'announcements', filter: `barangay_id=eq.${config.barangayId}` }, ...(owner ? [{ table: 'announcement_reads', filter: `resident_id=eq.${owner}` }] : [])];
  const resource = usePagedResource(`emergency-alerts:${key}`, alertsRead(api.announcements, effective), sources);
  const counts = useResource(`emergency-alert-counts:${key}`, (signal) => alertCounts(api.announcementCount, effective, signal));
  const { actions, state } = useReadActions(async () => { await resource.reload(); await counts.refresh(); refreshCounts(); });

  // Realtime and foreground reloads change the list; keep the exact counts in step with it.
  const fetchedAt = resource.state.fetchedAt;
  const { refresh: refreshAlertCounts } = counts;
  const lastFetch = useRef<number | null>(null);
  useEffect(() => {
    if (lastFetch.current !== null && fetchedAt !== null && fetchedAt !== lastFetch.current) void refreshAlertCounts();
    lastFetch.current = fetchedAt;
  }, [fetchedAt, refreshAlertCounts]);

  function change(field: keyof CustomInput, text: string) {
    const cleaned = field === 'month' ? sanitizeLetters(text) : sanitizeDigits(text, field === 'year' ? 4 : 2);
    setInput((previous) => ({ ...previous, [field]: cleaned.value }));
    setRejected((previous) => ({ ...previous, [field]: cleaned.rejected ? (field === 'month' ? 'Month accepts letters only.' : 'This field accepts numbers only.') : undefined }));
  }
  function clear() { setPeriod('all'); setInput(NO_INPUT); setRejected({}); }

  const total = counts.data?.total;
  const matching = counts.data ? counts.data.matching ?? resource.state.items.length : null;
  const approximate = counts.data?.matching === null && !resource.state.complete;
  const count = counts.data ? `${matching}${approximate ? '+' : ''}` : '–';
  const custom = activeCustomCount(input);

  const controls = <>
    {header}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <SymbolIcon name="exclamationmark.triangle" color={colors.danger} size={18} />
      <View style={{ flex: 1 }}><Body heading role="headline">Emergency alerts</Body></View>
      <View accessible accessibilityLabel={`${count} alerts shown`}><Body role="headline">{count}</Body></View>
    </View>
    <Segmented<AlertPeriod> label="Alert period" options={ALERT_PERIOD_OPTIONS} selected={period} onChange={setPeriod} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: customOpen }} accessibilityLabel={custom > 0 ? `Filter by specific date, ${custom} active` : 'Filter by specific date'}
      onPress={() => setCustomOpen((open) => !open)} style={{ minHeight: layout.controlMin, flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <SymbolIcon name="calendar" color={colors.textSecondary} size={15} />
      <View style={{ flex: 1 }}><Body role="callout" tone="secondary">{custom > 0 ? `Filter by specific date (${custom} active)` : 'Filter by specific date'}</Body></View>
      <SymbolIcon name={customOpen ? 'chevron.up' : 'chevron.down'} color={colors.textTertiary} size={14} />
    </Pressable>
    {customOpen && <Card>
      <Field label="Month" value={input.month} onChangeText={(text) => change('month', text)} placeholder="e.g. January" autoCapitalize="none" error={errors.month ?? rejected.month} />
      <Field label="Day" value={input.day} onChangeText={(text) => change('day', text)} placeholder="e.g. 15" keyboardType="number-pad" maxLength={2} error={errors.day ?? rejected.day} />
      <Field label="Year" value={input.year} onChangeText={(text) => change('year', text)} placeholder="e.g. 2026" keyboardType="number-pad" maxLength={4} error={errors.year ?? rejected.year} />
    </Card>}
    {filtered && <Action label="Clear filters" secondary onPress={clear} />}
    {total !== undefined && total > 0 && !invalid && <Body role="footnote" tone="secondary">{`Showing ${count} of ${total} ${total === 1 ? 'alert' : 'alerts'}`}</Body>}
    {counts.error && !counts.data && <Body role="footnote" tone="danger">The alert count could not be loaded.</Body>}
    {!!state.message && <Notice message={state.message} tone={state.failed ? 'danger' : 'primary'} />}
  </>;

  return <ResourceList resource={resource} header={controls} filtered={filtered}
    empty={{ title: 'No emergency alerts', message: 'There are no emergency alerts at this time. Alerts your barangay publishes appear here.' }}
    noResults={{ title: invalid ? 'Check the date filter' : 'No emergency alerts match your filter', message: invalid ? 'Correct the highlighted date field to see matching alerts.' : 'Try a different period or date, or clear the filters.' }}
    render={(item) => {
      const read = owner ? state.announcements[item.id] ?? item.read : null;
      return <Card>
        <StatusBadge label="Emergency" icon="exclamationmark.triangle" tone="danger" />
        <Destination title={item.title} detail={formatRelativeTime(item.published_at)} href={{ pathname: '/reports/announcements/[announcementId]', params: { announcementId: item.id } }} />
        <Body role="footnote" tone="secondary">{announcementPreview(item.body)}</Body>
        <Body role="footnote" tone="secondary">{formatDateTime(item.published_at)}</Body>
        {read === false && <UnreadMark />}
        {owner && read !== null && <Action label={read ? 'Mark as unread' : 'Mark as read'} secondary disabled={state.busy} onPress={() => void actions.setAnnouncementRead(item.id, !read)} />}
      </Card>;
    }} />;
}

function UnreadMark() {
  const colors = useColors();
  return <View accessible accessibilityLabel="Unread" style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
    <SymbolIcon name="circle.fill" color={colors.primary} size={10} /><Body role="footnote">Unread</Body>
  </View>;
}
