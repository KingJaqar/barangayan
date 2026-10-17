import { ANNOUNCEMENT_CATEGORY_META, formatDate, formatDateTime, type AnnouncementCategory } from '@barangayan/shared';
import type { IconName } from '@expo/ui';
import { useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Image, View } from 'react-native';
import { ResourceList } from '../../components/resource-list';
import { Action, Body, Card, Destination, EmptyState, Notice, Screen, Segmented, StatusBadge, SymbolIcon, type StatusTone } from '../../components/ui';
import { useAuthFlow } from '../../auth/auth-flow';
import {
  ANNOUNCEMENT_FILTER_OPTIONS, GUEST_VIEW_OPTIONS, INCIDENT_FILTER_OPTIONS, incidentStatuses, incidentStatusLabel, resolveView, VIEW_OPTIONS,
  type AnnouncementFilter, type IncidentFilter, type IncidentStatus, type ReportsView,
} from '../../data/report-filters';
import { reportSignals } from '../../data/report-signals';
import { useReportCounts } from '../../data/report-counts';
import { useApi } from '../../data/use-api';
import { usePagedResource } from '../../data/use-paged-resource';
import { formatRelativeTime } from '../../lib/format';
import { useLatest } from '../../lib/use-latest';
import { useResident } from '../../lib/runtime';
import { radius, space, useColors } from '../../lib/theme';
import { announcementPreview, incidentPhoto } from './media';
import { useReadActions } from './use-read-actions';

const CATEGORY_PRESENTATION: Record<AnnouncementCategory, { icon: IconName }> = {
  general: { icon: 'info.circle' }, emergency: { icon: 'exclamationmark.triangle' }, health: { icon: 'heart' }, events: { icon: 'calendar' },
};
export const STATUS_PRESENTATION: Record<IncidentStatus, { icon: IconName; tone: StatusTone }> = {
  open: { icon: 'clock', tone: 'info' },
  in_progress: { icon: 'arrow.triangle.2.circlepath', tone: 'warning' },
  resolved: { icon: 'checkmark.circle', tone: 'success' },
  withdrawn: { icon: 'xmark.circle', tone: 'neutral' },
  unresolved: { icon: 'exclamationmark.circle', tone: 'danger' },
};

/**
 * Reports (A32, A35, A36): the resident's own reports (all, active, resolved) and the barangay
 * announcements, with the three independent counters. The route's `segment` parameter (or the
 * Android `tab`) selects the view and is written back, so links and a return to the tab agree.
 * Switching view remounts the list, which resets every filter.
 */
export function ReportsHub() {
  const { session } = useResident();
  const params = useLocalSearchParams();
  const router = useRouter();
  const signedIn = session !== null;
  const view = resolveView(params.segment, params.tab, signedIn);
  const options = signedIn ? VIEW_OPTIONS : GUEST_VIEW_OPTIONS;
  const header = <>
    {signedIn && <ReportSignals />}
    <Segmented<ReportsView> label="Reports view" options={options} selected={view} onChange={(next) => router.setParams({ segment: next, tab: undefined })} />
  </>;
  if (view === 'announcements') return <AnnouncementsView key={view} header={header} />;
  if (!signedIn) return <GuestIncidents header={header} />;
  return <IncidentsView key={view} view={view} header={header} />;
}

/** The three independent signals, labeled, so they stay readable when Reports sits inside More. */
function ReportSignals() {
  const { counts, failed, refresh } = useReportCounts();
  return <Card>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
      {reportSignals(counts).map((signal) => <View key={signal.key} accessible accessibilityLabel={`${signal.label}: ${signal.value ?? 'unavailable'}`} style={{ minWidth: 96, flexGrow: 1, gap: space[1] }}>
        <Body role="title2">{signal.value ?? '–'}</Body><Body role="footnote" tone="secondary">{signal.label}</Body>
      </View>)}
    </View>
    {failed && <><Body role="footnote" tone="danger">These counts could not be refreshed. The values shown may be out of date.</Body><Action label="Refresh counts" secondary onPress={refresh} /></>}
  </Card>;
}

function GuestIncidents({ header }: { header: ReactNode }) {
  const { rememberDestination } = useAuthFlow();
  const pathname = usePathname();
  useEffect(() => { rememberDestination(pathname); }, [pathname, rememberDestination]);
  return <Screen>{header}
    <EmptyState title="Log in required" message="Log in to report an issue or follow your reports. Announcements remain available without an account.">
      <Destination title="Log in or create an account" href="/auth/choice" />
    </EmptyState>
  </Screen>;
}

function ReadNotice({ message, failed }: { message: string; failed: boolean }) {
  return message ? <Notice message={message} tone={failed ? 'danger' : 'primary'} /> : null;
}

function IncidentsView({ view, header }: { view: ReportsView; header: ReactNode }) {
  const api = useApi();
  const { session, config } = useResident();
  const { refresh: refreshCounts } = useReportCounts();
  const [filter, setFilter] = useState<IncidentFilter>('all');
  const owner = session?.user.id;
  const statuses = incidentStatuses(view, filter);
  const resource = usePagedResource(`incidents:${statuses?.join(',') ?? 'all'}`, api.incidents(statuses), owner ? [{ table: 'incidents', filter: `reporter_id=eq.${owner}` }] : []);
  const { actions, state } = useReadActions(async () => { await resource.reload(); refreshCounts(); });
  const router = useRouter();
  // Coming back from a report or the report form shows its filing, withdrawal or status change at once (A32-030).
  const reload = useLatest(async () => { await resource.reload(); refreshCounts(); });
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focused.current) void reload.current();
    focused.current = true;
  }, [reload]));
  const heading = view === 'active' ? 'Active reports' : view === 'resolved' ? 'Resolved reports' : 'My incident reports';
  const controls = <>
    {header}
    <Body heading role="headline">{heading}</Body>
    {view === 'incidents' && <Segmented<IncidentFilter> label="Report status" options={INCIDENT_FILTER_OPTIONS} selected={filter} onChange={setFilter} />}
    {view === 'resolved' && <Action label={state.busy ? 'Working…' : 'Mark all as read'} secondary disabled={state.busy} hint="Marks every unread resolved report as read" onPress={() => void actions.markAllResolvedRead()} />}
    <ReadNotice message={state.message} failed={state.failed} />
    <Action label="Report an issue" hint="Opens the report form" onPress={() => router.push('/reports/new')} />
  </>;
  const emptyCopy = view === 'active' ? 'No active incident reports.' : view === 'resolved' ? 'No resolved incident reports yet.' : 'You have not submitted any incident reports yet.';
  return <ResourceList resource={resource} header={controls} filtered={filter !== 'all'}
    empty={{ title: 'No reports', message: emptyCopy }}
    noResults={{ title: 'No reports here', message: 'None of your reports have this status. Choose another status to see the rest.' }}
    render={(incident) => {
      const status = (incident.status in STATUS_PRESENTATION ? incident.status : null) as IncidentStatus | null;
      const resolved = incident.status === 'resolved';
      const read = state.incidents[incident.id] ?? incident.resolved_read_at !== null;
      const photo = incidentPhoto(incident.photo_urls, config.url);
      return <Card>
        <Destination title={incident.title} detail={incident.incident_categories?.name} href={{ pathname: '/reports/incidents/[incidentId]', params: { incidentId: incident.id } }} />
        {status ? <StatusBadge label={incidentStatusLabel(status)} {...STATUS_PRESENTATION[status]} /> : <StatusBadge label="Unknown" icon="questionmark.circle" tone="neutral" />}
        <Body role="footnote" tone="secondary">{`Submitted ${formatDate(incident.created_at)}`}</Body>
        {photo && <PhotoThumbnail uri={photo} />}
        {resolved && !read && <UnreadMark />}
        {resolved && <Action label={read ? 'Mark as unread' : 'Mark as read'} secondary disabled={state.busy} onPress={() => void actions.setIncidentRead(incident.id, !read)} />}
      </Card>;
    }} />;
}

function AnnouncementsView({ header }: { header: ReactNode }) {
  const api = useApi();
  const { session, config } = useResident();
  const { refresh: refreshCounts } = useReportCounts();
  const [filter, setFilter] = useState<AnnouncementFilter>('all');
  const owner = session?.user.id;
  const sources = [{ table: 'announcements', filter: `barangay_id=eq.${config.barangayId}` }, ...(owner ? [{ table: 'announcement_reads', filter: `resident_id=eq.${owner}` }] : [])];
  const resource = usePagedResource(`announcements:${filter}`, api.announcements(filter), sources);
  const { actions, state } = useReadActions(async () => { await resource.reload(); refreshCounts(); });
  const controls = <>
    {header}
    <Body heading role="headline">What&apos;s new</Body>
    <Segmented<AnnouncementFilter> label="Announcement category" options={ANNOUNCEMENT_FILTER_OPTIONS} selected={filter} onChange={setFilter} />
    {owner && <Action label={state.busy ? 'Working…' : 'Mark all as read'} secondary disabled={state.busy} hint="Marks every unread announcement as read" onPress={() => void actions.markAllAnnouncementsRead()} />}
    <ReadNotice message={state.message} failed={state.failed} />
  </>;
  return <ResourceList resource={resource} header={controls} filtered={filter !== 'all'}
    empty={{ title: 'No announcements yet', message: 'Your barangay has not published any announcements.' }}
    noResults={{ title: 'No announcements here', message: 'There are no announcements in this category. Choose another category to see the rest.' }}
    render={(item) => {
      const category = item.category in CATEGORY_PRESENTATION ? (item.category as AnnouncementCategory) : null;
      const read = owner ? state.announcements[item.id] ?? item.read : null;
      return <Card>
        <Destination title={item.title} detail={`${category ? ANNOUNCEMENT_CATEGORY_META[category].label : item.category} · ${formatRelativeTime(item.published_at)}`}
          href={{ pathname: '/reports/announcements/[announcementId]', params: { announcementId: item.id } }} />
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

function PhotoThumbnail({ uri }: { uri: string }) {
  const colors = useColors();
  const [failed, setFailed] = useState(false);
  if (failed) return <Body role="footnote" tone="secondary">The photo could not be loaded.</Body>;
  return <Image source={{ uri }} accessibilityLabel="Report photo" accessibilityIgnoresInvertColors resizeMode="cover" onError={() => setFailed(true)}
    style={{ height: 140, borderRadius: radius.md, backgroundColor: colors.surfaceSelected }} />;
}
