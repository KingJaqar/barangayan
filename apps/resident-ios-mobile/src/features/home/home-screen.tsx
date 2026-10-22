import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';
import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import { RequestStatus } from '../../components/request-status';
import { Action, Body, Card, Destination, EmptyState, ErrorState, Loading, Screen, SymbolIcon } from '../../components/ui';
import { subscribeToChanges } from '../../data/realtime';
import { useReportCounts } from '../../data/report-counts';
import { reportSignals } from '../../data/report-signals';
import { ALL_REQUESTS } from '../../data/request-filters';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { useLatest } from '../../lib/use-latest';
import { useInboxCount } from '../notifications/inbox-count';
import { inboxDetail } from '../notifications/model';
import { initials } from '../profile/profile-form';
import { announcementPreview } from '../reports/media';
import { HOME_COPY } from './copy';
import { announcementStamp, bellLabel, displayName, greeting, QUICK_ACTIONS, showsProfileBanner } from './home-model';

/** Refreshes when the tab regains focus (a request filed elsewhere shows on return), never on the first focus, which the resource already covers. */
function useRefreshOnFocus(refresh: () => Promise<void>) {
  const first = useRef(true);
  const latest = useLatest(refresh);
  useFocusEffect(useCallback(() => {
    if (first.current) { first.current = false; return; }
    void latest.current();
  }, [latest]));
}

/**
 * Home (A08, D04): identity, profile prompt, quick actions, the resident's latest three requests, the three labeled Reports counts and the
 * latest announcement. Every card opens a working flow. There is deliberately no search field: no search source is defined for Home.
 */
export function HomeScreen() {
  const { session, profile } = useResident();
  const { setup } = useAuthFlow();
  const api = useApi();
  const colors = useColors();
  const type = useType();
  const barangay = useResource('barangay', api.barangay);
  const inbox = useInboxCount();
  const reports = useReportCounts();
  const unreadAnnouncements = reports.counts?.unreadAnnouncements ?? null;
  const name = displayName(profile?.full_name, profile?.first_name);

  return <Screen>
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <Avatar url={profile?.avatar_url ?? null} label={profile ? initials(profile) : null} />
        <View style={{ flex: 1, gap: space[1] }}>
          <Body heading>{session ? `${greeting(new Date().getHours())}, ${name}` : HOME_COPY.guestGreeting}</Body>
          <Body tone="secondary">{barangay.data?.name ?? (barangay.loading ? HOME_COPY.barangayLoading : HOME_COPY.barangayFallback)}</Body>
        </View>
        <Link href={{ pathname: '/reports', params: { segment: 'announcements' } }} asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={bellLabel(unreadAnnouncements)} accessibilityHint={HOME_COPY.bellHint}
            style={{ minHeight: layout.controlMin, minWidth: layout.controlMin, alignItems: 'center', justifyContent: 'center' }}>
            <SymbolIcon name="bell" color={colors.primary} size={22} />
            {unreadAnnouncements !== null && unreadAnnouncements > 0 && <View style={{ position: 'absolute', top: 2, right: 0, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[type.caption, { color: colors.surface }]}>{unreadAnnouncements > 99 ? '99+' : unreadAnnouncements}</Text>
            </View>}
          </Pressable>
        </Link>
      </View>
      {!session && <Destination title={HOME_COPY.signIn} detail={HOME_COPY.signInDetail} href="/auth/choice" />}
    </Card>
    {session && showsProfileBanner(setup) && <Card>
      <Body heading role="headline">{HOME_COPY.profileBannerTitle}</Body>
      <Body tone="secondary">{HOME_COPY.profileBannerBody}</Body>
      <Destination title={HOME_COPY.profileBannerAction} href="/complete-profile" />
    </Card>}
    <QuickActions />
    {session ? <RecentRequests /> : <Card><Body heading role="headline">{HOME_COPY.requestsTitle}</Body><Body tone="secondary">{HOME_COPY.requestsGuest}</Body></Card>}
    {session && <ReportsSummary />}
    <LatestAnnouncement />
    {session && releaseGates.remotePush && <Card><Destination title={HOME_COPY.inboxTitle} detail={inboxDetail(inbox.count)} href="/notifications" /></Card>}
  </Screen>;
}

function Avatar({ url, label }: { url: string | null; label: string | null }) {
  const colors = useColors();
  const type = useType();
  const [failed, setFailed] = useState(false);
  // A profile photo is a table value: only a plain https address is fetched.
  const showImage = !!url && url.startsWith('https://') && !failed;
  return <View accessible accessibilityRole="image" accessibilityLabel={showImage ? HOME_COPY.avatarLabel : HOME_COPY.avatarFallbackLabel}
    style={{ width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: colors.surfaceSelected, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }}>
    {showImage ? <Image source={{ uri: url }} style={{ width: 52, height: 52 }} accessibilityIgnoresInvertColors onError={() => setFailed(true)} />
      : label ? <Text style={[type.headline, { color: colors.primary }]}>{label}</Text> : <SymbolIcon name="person" color={colors.primary} size={24} />}
  </View>;
}

function QuickActions() {
  const colors = useColors();
  const type = useType();
  return <View accessibilityRole="menu" accessibilityLabel={HOME_COPY.quickActionsLabel} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
    {QUICK_ACTIONS.map((action) => <Link key={action.key} href={action.href} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={action.label} accessibilityHint={action.hint}
        style={({ pressed }) => ({ flexBasis: '47%', flexGrow: 1, minHeight: layout.listRowMin + space[4], padding: space[3], gap: space[2], borderRadius: radius.md, borderCurve: 'continuous', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.7 : 1 })}>
        <SymbolIcon name={action.icon} color={colors.primary} size={24} />
        <Text style={[type.headline, { color: colors.textPrimary }]}>{action.label}</Text>
      </Pressable>
    </Link>)}
  </View>;
}

/** The latest three requests (A08-018…025). Mounted for a signed-in resident only. */
function RecentRequests() {
  const api = useApi();
  const { client, session } = useResident();
  const owner = session?.user.id;
  const resource = useResource('home:requests', (signal) => api.requests(ALL_REQUESTS)({ from: 0, to: 2 }, signal));
  const refresh = useLatest(resource.refresh);
  useRefreshOnFocus(resource.refresh);
  useEffect(() => {
    if (!owner) return;
    return subscribeToChanges(client, 'home-requests', [{ table: 'service_requests', filter: `resident_id=eq.${owner}` }], () => void refresh.current());
  }, [client, owner, refresh]);
  const requests = resource.data;
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Body heading role="headline">{HOME_COPY.requestsTitle}</Body>
      <Link href="/requests" asChild><Pressable accessibilityRole="link" accessibilityLabel={HOME_COPY.viewAllRequests} style={{ minHeight: layout.controlMin, justifyContent: 'center' }}><LinkText>{HOME_COPY.viewAll}</LinkText></Pressable></Link>
    </View>
    {resource.loading && !requests && <Loading label={HOME_COPY.requestsLoading} />}
    {resource.error && !requests && <ErrorState message={resource.error} retry={() => void resource.refresh()} />}
    {resource.error && requests && <Body role="footnote" tone="danger">{HOME_COPY.requestsStale}</Body>}
    {requests && requests.length === 0 && <Body tone="secondary">{HOME_COPY.requestsEmpty}</Body>}
    {requests?.map((request) => <View key={request.id} style={{ gap: space[1] }}>
      <Destination title={request.document_types?.name ?? request.reference_number} detail={request.reference_number} href={{ pathname: '/request/[id]', params: { id: request.id } }} />
      <RequestStatus status={request.status} paymentStatus={request.payment_status} />
    </View>)}
  </Card>;
}

function LinkText({ children }: { children: string }) {
  const colors = useColors();
  const type = useType();
  return <Text style={[type.body, { color: colors.primary }]}>{children}</Text>;
}

/** The three independent Reports counts, labeled (A36); each is unavailable rather than zero while it cannot be confirmed. */
function ReportsSummary() {
  const { counts, failed, refresh } = useReportCounts();
  const signals = reportSignals(counts);
  return <Card>
    <Body heading role="headline">{HOME_COPY.reportsTitle}</Body>
    {signals.map((signal) => <View key={signal.key} accessible accessibilityLabel={`${signal.label}: ${signal.value ?? HOME_COPY.countUnavailable}`} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Body tone="secondary">{signal.label}</Body><Body>{signal.value === null ? '–' : String(signal.value)}</Body>
    </View>)}
    {failed && <><Body role="footnote" tone="danger">{HOME_COPY.countsStale}</Body><Action label="Try again" secondary onPress={refresh} /></>}
    <Destination title={HOME_COPY.reportsOpen} href="/reports" />
  </Card>;
}

function LatestAnnouncement() {
  const api = useApi();
  const resource = useResource('home:announcement', (signal) => api.announcements('all')({ from: 0, to: 0 }, signal));
  useRefreshOnFocus(resource.refresh);
  const latest = resource.data?.[0];
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Body heading role="headline">{HOME_COPY.announcementsTitle}</Body>
      <Link href={{ pathname: '/reports', params: { segment: 'announcements' } }} asChild><Pressable accessibilityRole="link" accessibilityLabel={HOME_COPY.viewAllAnnouncements} style={{ minHeight: layout.controlMin, justifyContent: 'center' }}><LinkText>{HOME_COPY.viewAll}</LinkText></Pressable></Link>
    </View>
    {resource.loading && !resource.data && <Loading label={HOME_COPY.announcementsLoading} />}
    {resource.error && !resource.data && <ErrorState message={resource.error} retry={() => void resource.refresh()} />}
    {resource.error && resource.data && <Body role="footnote" tone="danger">{HOME_COPY.announcementsStale}</Body>}
    {resource.data && !latest && <EmptyState title={HOME_COPY.announcementsEmptyTitle} message={HOME_COPY.announcementsEmpty} />}
    {latest && <Link href={{ pathname: '/reports/announcements/[announcementId]', params: { announcementId: latest.id } }} asChild>
      <Pressable accessibilityRole="link" accessibilityLabel={`${latest.title}, ${announcementStamp(latest.published_at)}`} accessibilityHint={HOME_COPY.announcementHint}
        style={({ pressed }) => ({ gap: space[1], opacity: pressed ? 0.6 : 1, minHeight: layout.listRowMin, justifyContent: 'center' })}>
        <Body role="footnote" tone="secondary">{`${category(latest.category)} · ${announcementStamp(latest.published_at)}`}</Body>
        <Body heading role="headline">{latest.title}</Body>
        <Body tone="secondary">{announcementPreview(latest.body)}</Body>
      </Pressable>
    </Link>}
  </Card>;
}

function category(value: string): string {
  return value in ANNOUNCEMENT_CATEGORY_META ? ANNOUNCEMENT_CATEGORY_META[value as AnnouncementCategory].label : value;
}
