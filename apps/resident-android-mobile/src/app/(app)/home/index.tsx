import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { DrrmTabIcon } from '@/components/drrm-tab-icon';
import { ServicesTabIcon } from '@/components/services-tab-icon';
import { HomeAction } from '@/components/home/home-action';
import { RequestSummarySheet } from '@/components/home/request-summary-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { ThemedText } from '@/components/themed-text';
import { DocumentIcon } from '@/components/document-icon';
import { getDocumentIcon } from '@/constants/document-icons';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { RefreshResource } from '@/lib/refresh-resource';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useProfile } from '@/hooks/use-profile';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { homeRequestSummary, homeRequestTitle, homeTimestamp, type HomeRequest } from '@/lib/home-request';
import { useHomeAnnouncements } from '@/hooks/use-home-announcements';
import { advisoryExpiry, announcementPreview } from '@/lib/home-announcement';
import { supabase } from '@/lib/supabase';


const QUICK_ACTIONS = [
  { label: 'Services', description: 'Browse documents and services', href: '/services', icon: 'clipboard-outline', tone: 'accent', foreground: 'onAccent' },
  { label: 'Reports', description: 'Report an issue', href: '/reports', icon: 'warning-outline', tone: 'warning', foreground: 'onWarning' },
  { label: 'Emergency', description: 'Emergency information', href: '/drrm', icon: 'drrm', tone: 'danger', foreground: 'onDanger' },
  { label: 'Maps', description: 'Open barangay maps', href: '/maps', icon: 'location-outline', tone: 'info', foreground: 'onInfo' },
  { label: 'Health', description: 'Open health services', href: '/health', icon: 'heart-outline', tone: 'rose', foreground: 'onRose' },
] as const;

async function loadHomeRequests(signal: AbortSignal) {
  const { data, error } = await supabase.rpc('resident_home_requests', { p_qrph_settlement_ready: PAYMENT_SETTLEMENT_READY })
    .abortSignal(signal).retry(false);
  if (error) throw error;
  if (!data || data.length > 3 || new Set(data.map(item => item.id)).size !== data.length) throw new Error('Invalid Home request response');
  return { items: data, refreshedAt: new Date().toISOString() };
}

export default function HomeScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const { profile, refetch: refetchProfile } = useProfile();
  const { resident } = useTheme();
  const router = useRouter();
  const bottomTabInset = useFloatingTabInset();
  const reducedMotion = useResidentReducedMotion(true);
  const { width, fontScale } = useWindowDimensions();
  const compactActions = (Math.min(width, MaxContentWidth) - 24) / 5 < 64 * fontScale;
  const actionColumns = compactActions ? Math.max(1, Math.min(3, Math.floor((Math.min(width, MaxContentWidth) - 24) / (64 * fontScale)))) : 5;
  const requestWidth = Math.max(1, Math.min(width, MaxContentWidth) - 40);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const requestKey = JSON.stringify([userId, profile?.id === userId ? profile?.barangay_id : null]);
  const requestResource = useMemo(() => new RefreshResource(requestKey, loadHomeRequests, 'Your requests could not be loaded. Please try again.', undefined, 12_000), [requestKey]);
  const requestState = useSyncExternalStore(requestResource.subscribe, requestResource.getSnapshot, requestResource.getSnapshot);
  const announcements = useHomeAnnouncements(requestKey);
  const { news, alerts, offline } = announcements;
  const [selectedRequest, setSelectedRequest] = useState<{ key: string; request: HomeRequest } | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pendingTracking = useRef<string | null>(null);
  const homeActive = useRef(true);
  const requestTargets = useRef(new Map<string, View>());
  const requestFallbackTarget = useRef<View>(null);
  const visibleRequestId = useRef<string | null>(null);
  const pull = usePullRefresh([announcements.refresh, () => userId ? requestResource.refresh() : undefined, refetchProfile]);

  useEffect(() => {
    pendingTracking.current = null;
    setSheetOpen(false);
    setSelectedRequest(null);
  }, [requestKey]);

  useFocusEffect(useCallback(() => {
    homeActive.current = true;
    requestResource.activate();
    if (userId) void requestResource.refresh();
    const listener = AppState.addEventListener('change', state => {
      homeActive.current = state === 'active';
      if (state !== 'active') { pendingTracking.current = null; setSheetOpen(false); requestResource.cancel(); }
      else { requestResource.activate(); if (userId) void requestResource.refresh(); }
    });
    return () => { homeActive.current = false; listener.remove(); requestResource.cancel(); pendingTracking.current = null; setSheetOpen(false); };
  }, [requestResource, userId]));

  const requests = requestState.data;
  const currentSelection = selectedRequest?.key === requestKey && userId ? selectedRequest : null;
  const selectedLive = requests?.items.find(item => item.id === currentSelection?.request.id);
  const selected = selectedLive ?? currentSelection?.request ?? null;
  useEffect(() => {
    if (sheetOpen && !selectedLive) { pendingTracking.current = null; setSheetOpen(false); }
  }, [sheetOpen, selectedLive]);
  const announcement = news.data?.items[0];
  const announcementTone = announcement?.category === 'emergency' ? resident.danger
    : announcement?.category === 'health' ? resident.rose : resident.accentText;

  function closeSheet() { pendingTracking.current = null; setSheetOpen(false); }
  function afterDismiss() {
    const id = pendingTracking.current;
    pendingTracking.current = null;
    if (!homeActive.current) return;
    // Keep tracking in Home's stack so Back removes it without changing Services.
    if (id && selectedLive?.id === id) router.push(`/home/requests/${id}`);
    else {
      const target = (selected?.id === visibleRequestId.current ? requestTargets.current.get(selected.id) : null) ?? requestFallbackTarget.current;
      if (target) { target.focus(); AccessibilityInfo.sendAccessibilityEvent(target, 'focus'); }
    }
  }

  return <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: resident.card }]}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomTabInset + 20 }]}
      refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}>
      <View style={styles.inset}><ProfileCompletionBanner /></View>
      {offline ? <HomeListState label="You’re offline. Showing last-known information where available. Pull to refresh when connected." /> : null}
      <View style={styles.identitySection}>
        {userId ? <View style={styles.identity}>
          <Avatar fullName={profile?.full_name ?? 'Resident'} imageUrl={profile?.avatar_url} size={36} foregroundColor={resident.onAccent} />
          <View style={styles.locationGroup}>
            <Ionicons name="location-outline" size={16} color={resident.accentText} accessible={false} />
            <ThemedText style={[styles.location, { color: resident.text }]}>{profile?.barangays?.name ?? 'Barangayan'}</ThemedText>
          </View>
        </View> : <HomeAction reducedMotion={reducedMotion} hitSlop={4} accessibilityLabel="Log in" onPress={() => router.push('/(auth)/login')} style={styles.identity}>
          <Avatar icon="person" size={36} foregroundColor={resident.onAccent} />
          <ThemedText style={[styles.location, { color: resident.text }]}>Log in</ThemedText>
        </HomeAction>}
      </View>
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map(action => <HomeAction key={action.label} reducedMotion={reducedMotion} pressScale={0.95}
          accessibilityLabel={action.label} accessibilityHint={action.description}
          onPress={() => router.push(action.href === '/services' ? { pathname: '/services', params: { segment: 'documents' } } : action.href)}
          style={[styles.quickAction, { width: `${100 / actionColumns}%` }]}>
          <View style={[styles.quickIcon, { backgroundColor: resident[action.tone], borderColor: resident.controlBorder, borderWidth: action.tone === 'accent' && resident.accentNeedsOutline ? 1 : 0 }]}>
            {action.href === '/services'
              ? <ServicesTabIcon size={24} color={resident[action.foreground]} />
              : action.icon === 'drrm'
              ? <DrrmTabIcon size={24} color={resident[action.foreground]} />
              : <Ionicons name={action.icon} size={24} color={resident[action.foreground]} accessible={false} />}
          </View>
          <ThemedText style={[styles.quickLabel, { color: resident.text }]}>{action.label}</ThemedText>
        </HomeAction>)}
      </View>
      <View style={styles.section}>
        {announcements.active.map(item => <View key={item.id} style={[styles.inset, { marginBottom: 12 }]}>
          <HomeAction reducedMotion={reducedMotion} accessibilityLabel={`View advisory: ${item.title}. ${announcementPreview(item.body)}`}
            onPress={() => router.push({ pathname: '/announcements', params: { announcementId: item.id } })}
            style={[styles.card, { backgroundColor: resident.surface, borderColor: resident.danger, gap: 8, minHeight: 48 }]}>
            <ThemedText style={[styles.status, { color: resident.danger }]}>{alerts.error || alerts.fetching || offline ? 'Last-known emergency advisory' : 'Emergency advisory'}</ThemedText>
            <ThemedText style={[styles.cardTitle, { color: resident.text }]}>{item.title}</ThemedText>
            <ThemedText style={[styles.subtitle, { color: resident.text }]}>{announcementPreview(item.body)}</ThemedText>
            <ThemedText style={[styles.reference, { color: resident.muted }]}>Published {homeTimestamp(item.published_at)} · Expires {homeTimestamp(item.alert_expires_at ?? '')}</ThemedText>
            <ThemedText style={[styles.seeAllText, { color: resident.accentText }]}>View advisory</ThemedText>
          </HomeAction>
        </View>)}
        {!alerts.data ? <HomeListState loading={!alerts.error} label={alerts.error ?? 'Checking emergency advisories…'} onRetry={alerts.error ? announcements.retryAlerts : undefined} /> : null}
        {alerts.data ? <View style={styles.inset}><ThemedText style={[styles.reference, { color: resident.muted }]}>Advisories · Last refreshed {homeTimestamp(alerts.data.refreshedAt)}</ThemedText></View> : null}
        {alerts.data && alerts.error ? <HomeListState label={alerts.error} onRetry={announcements.retryAlerts} /> : null}
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <ThemedText accessibilityRole="header" style={[styles.sectionTitle, { color: resident.text }]}>Your requests</ThemedText>
            <ThemedText style={[styles.subtitle, { color: resident.muted }]}>{requests ? `${requests.items.length} ${requests.items.length === 1 ? 'request' : 'requests'} shown` : 'Your requests'}</ThemedText>
          </View>
          <HomeAction pressableRef={requestFallbackTarget} reducedMotion={reducedMotion} accessibilityLabel="View all requests" onPress={() => router.push({ pathname: '/services', params: { segment: 'requests' } })} style={styles.seeAll}>
            <ThemedText style={[styles.seeAllText, { color: resident.text }]}>See all</ThemedText>
          </HomeAction>
        </View>
        {!userId ? <HomeListState label="Log in to see your requests." action={{ label: 'Log in', onPress: () => router.push('/(auth)/login') }} />
          : !requests ? <HomeListState loading={!requestState.error} label={requestState.error ?? "Loading your requests…"} onRetry={requestState.error ? requestResource.refresh : undefined} />
          : requests.items.length === 0 ? <HomeListState label="No requests yet" action={{ label: 'Request a document', onPress: () => router.push({ pathname: '/services', params: { segment: 'documents' } }) }} />
          : <ScrollableChevronRow key={requestKey} label="requests" pageWidth={requestWidth} onIndexChange={index => { visibleRequestId.current = requests.items[index]?.id ?? null; }} contentContainerStyle={styles.shelf}>
            {requests.items.map(request => {
              const summary = homeRequestSummary(request);
              const title = homeRequestTitle(request);
              return <HomeAction key={request.id} reducedMotion={reducedMotion}
                pressableRef={target => { if (target) requestTargets.current.set(request.id, target); else requestTargets.current.delete(request.id); }}
                accessibilityLabel={[title, `reference ${request.reference_number}`, summary.progressLabel ?? summary.statusLabel, summary.cancelled ? summary.cancellationLabel : summary.paymentLabel, summary.updatedLabel, summary.nextAction].filter(Boolean).join(", ")}
                accessibilityHint="Opens a request summary" onPress={() => { if (sheetOpen || pendingTracking.current) return; pendingTracking.current = null; setSelectedRequest({ key: requestKey, request }); setSheetOpen(true); }}
                style={({ pressed }) => [styles.requestCard, styles.card, { width: requestWidth, backgroundColor: pressed ? resident.pressed : resident.card, borderColor: resident.border }]}>
                <View style={styles.requestTop}>
                  <View style={[styles.requestIcon, { backgroundColor: resident.accentSoft }]}>
                    <DocumentIcon name={getDocumentIcon(title)} size={16} color={resident.accentText} accessible={false} />
                  </View>
                  <View style={styles.requestInfo}>
                    <ThemedText style={[styles.cardTitle, { color: resident.text }]}>{title}</ThemedText>
                    <ThemedText style={[styles.reference, { color: resident.muted }]}>#{request.reference_number}</ThemedText>
                  </View>
                </View>
                <View style={styles.requestProgress}>
                  {summary.progressLabel ? <View style={styles.segments} accessible={false} importantForAccessibility="no-hide-descendants">
                    {summary.steps.map((step, index) => <View key={step.status} style={[styles.segment, { backgroundColor: index <= summary.stepIndex ? resident.accentText : resident.controlBorder }]} />)}
                  </View> : null}
                  <ThemedText style={[styles.status, { color: summary.cancelled ? resident.danger : resident.text }]}>{summary.progressLabel ?? summary.statusLabel}</ThemedText>
                  <ThemedText style={[styles.reference, { color: resident.muted }]}>{summary.updatedLabel}</ThemedText>
                  {summary.cancelled ? <>
                    <ThemedText style={[styles.reference, { color: resident.muted }]}>{summary.cancellationLabel}</ThemedText>
                    {summary.cancellationNote ? <ThemedText style={[styles.reference, { color: resident.text }]}>{summary.cancellationNote}</ThemedText> : null}
                  </> : <>
                    <ThemedText style={[styles.reference, { color: resident.muted }]}>{summary.paymentLabel}</ThemedText>
                    {summary.nextAction ? <ThemedText style={[styles.status, { color: resident.accentText }]}>{summary.nextAction}</ThemedText> : null}
                  </>}
                </View>
              </HomeAction>;
            })}
          </ScrollableChevronRow>}
        {userId && requests ? <View style={styles.inset}>
          <ThemedText style={[styles.reference, { color: resident.muted }]}>Last refreshed {homeTimestamp(requests.refreshedAt)}</ThemedText>
          {requestState.error ? <HomeListState label={requestState.error} onRetry={requestResource.refresh} /> : null}
        </View> : null}
      </View>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <ThemedText accessibilityRole="header" style={[styles.sectionTitle, { color: resident.text }]}>Around the barangay</ThemedText>
            <ThemedText style={[styles.subtitle, { color: resident.muted }]}>Latest announcements</ThemedText>
          </View>
          <HomeAction reducedMotion={reducedMotion} accessibilityLabel="View all announcements" onPress={() => router.push('/announcements')} style={styles.seeAll}>
            <ThemedText style={[styles.seeAllText, { color: resident.text }]}>See all</ThemedText>
          </HomeAction>
        </View>
        {!news.data ? <HomeListState loading={!news.error} label={news.error ?? "Loading announcements…"} onRetry={news.error ? announcements.retryNews : undefined} />

          : announcement ? <View style={styles.shelf}>
            <HomeAction reducedMotion={reducedMotion} accessibilityLabel={`Read announcement: ${announcement.title}`}
              onPress={() => router.push({ pathname: '/announcements', params: { announcementId: announcement.id } })}
              style={({ pressed }) => [styles.announcementCard, styles.card, { backgroundColor: pressed ? resident.pressed : resident.card, borderColor: resident.border }]}>
              <View style={styles.newsMeta}>
                <View style={styles.categoryGroup}>
                  <View style={[styles.categoryDot, { backgroundColor: announcementTone }]} />
                  <ThemedText style={[styles.category, { color: announcementTone }]}>{ANNOUNCEMENT_CATEGORY_META[announcement.category as AnnouncementCategory]?.label ?? announcement.category}</ThemedText>
                </View>
                <ThemedText style={[styles.newsDate, { color: resident.muted }]}>{homeTimestamp(announcement.published_at)}</ThemedText>
              </View>
              {announcement.image_url ? failedImage === announcement.image_url
                ? <ThemedText style={[styles.reference, { color: resident.muted }]}>Announcement image unavailable.</ThemedText>
                : <Image source={{ uri: announcement.image_url }} contentFit="cover" style={styles.announcementImage}
                    accessibilityLabel={`${announcement.title} image`} onError={() => setFailedImage(announcement.image_url)} />
                : null}
              <ThemedText style={[styles.cardTitle, styles.newsTitle, { color: resident.text }]}>{announcement.title}</ThemedText>
              {advisoryExpiry(announcement) !== null && Date.parse(announcement.alert_expires_at ?? '') <= announcements.clock ? <ThemedText style={[styles.status, { color: resident.muted }]}>Expired</ThemedText> : null}
              <ThemedText style={[styles.subtitle, { color: resident.text }]}>{announcementPreview(announcement.body ?? '')}</ThemedText>
              <ThemedText style={[styles.seeAllText, { color: resident.accentText }]}>View details</ThemedText>
            </HomeAction>
          </View> : <HomeListState label="No announcements yet." />}
        {news.data ? <View style={styles.inset}><ThemedText style={[styles.reference, { color: resident.muted }]}>Announcements · Last refreshed {homeTimestamp(news.data.refreshedAt)}</ThemedText></View> : null}
        {news.data && news.error ? <HomeListState label={news.error} onRetry={announcements.retryNews} /> : null}
      </View>
    </ScrollView>
    {selected ? <RequestSummarySheet request={selected} available={Boolean(selectedLive)} visible={sheetOpen} reducedMotion={reducedMotion} onClose={closeSheet} onDismiss={afterDismiss}
      onViewFull={() => { if (!sheetOpen || !selectedLive || pendingTracking.current) return; pendingTracking.current = selectedLive.id; setSheetOpen(false); }} /> : null}
  </SafeAreaView>;
}

function HomeListState({ label, loading = false, onRetry, action }: { label: string; loading?: boolean; onRetry?: () => void; action?: { label: string; onPress: () => void } }) {
  const { resident } = useTheme();
  return <View style={[styles.listState, { backgroundColor: resident.surface }]} accessibilityLiveRegion="polite" accessibilityState={{ busy: loading }}>
    {loading ? <ActivityIndicator color={resident.accentText} /> : null}
    <ThemedText style={[styles.subtitle, { color: onRetry ? resident.danger : resident.muted }]}>{label}</ThemedText>
    {onRetry ? <PrimaryButton presentation="resident" variant="secondary" label="Try again" onPress={onRetry} /> : null}
    {action ? <PrimaryButton presentation="resident" variant="secondary" label={action.label} onPress={action.onPress} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  inset: { paddingHorizontal: 20 },
  identitySection: { paddingHorizontal: 20, paddingVertical: 16 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 48 },
  locationGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginBottom: 16, rowGap: 8 },
  quickAction: { alignItems: 'center', paddingVertical: 4, gap: 8, minWidth: 0, minHeight: 48 },
  quickIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center', alignSelf: 'stretch' },
  section: { marginBottom: 16 },
  sectionHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 12 },
  sectionHeading: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 21, lineHeight: 26.25, fontWeight: '800', letterSpacing: -0.525 },
  subtitle: { fontSize: 13, lineHeight: 19.5, marginTop: 2 },
  seeAll: { minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' },
  seeAllText: { fontSize: 14, lineHeight: 20, fontWeight: '600', textDecorationLine: 'underline' },
  shelf: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 12, alignItems: 'stretch' },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, shadowColor: '#000', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  requestCard: { flexGrow: 1 },
  requestTop: { flexDirection: 'row', gap: 10 },
  requestIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  requestInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700', minHeight: 36 },
  reference: { fontSize: 11.5, lineHeight: 17.25, marginTop: 2 },
  requestProgress: { marginTop: 'auto', paddingTop: 10 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  status: { marginTop: 6, fontSize: 11.5, lineHeight: 17.25, fontWeight: '700' },
  announcementCard: { flex: 1, maxWidth: '100%', gap: 6 },
  announcementImage: { width: '100%', aspectRatio: 2.4, borderRadius: 8 },
  newsTitle: { fontWeight: '600' },
  newsMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  newsDate: { fontSize: 11.5, lineHeight: 17.25, textAlign: 'right', flexShrink: 1 },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  category: { fontSize: 11.5, lineHeight: 17.25, fontWeight: '700', textTransform: 'capitalize', flexShrink: 1 },
  listState: { marginHorizontal: 20, borderRadius: 12, padding: 16, gap: 12 },
});
