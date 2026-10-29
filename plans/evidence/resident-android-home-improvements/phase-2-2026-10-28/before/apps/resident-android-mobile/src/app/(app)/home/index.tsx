import { Ionicons } from '@expo/vector-icons';
import type { Tables } from '@barangayan/shared';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, AppState, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { DrrmTabIcon } from '@/components/drrm-tab-icon';
import { ServicesTabIcon } from '@/components/services-tab-icon';
import { GuestPrompt } from '@/components/guest-prompt';
import { HomeAction } from '@/components/home/home-action';
import { RequestSummarySheet } from '@/components/home/request-summary-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { ThemedText } from '@/components/themed-text';
import { DocumentIcon } from '@/components/document-icon';
import { getDocumentIcon } from '@/constants/document-icons';
import { MaxContentWidth } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useProfile } from '@/hooks/use-profile';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { homeGreeting, homeRequestSummary, homeTimestamp, type HomeRequest } from '@/lib/home-request';
import { supabase } from '@/lib/supabase';

type Announcement = Tables<'announcements'>;
const QUICK_ACTIONS = [
  { label: 'Documents', description: 'Request a document', href: '/services', icon: 'clipboard-outline', tone: 'accent', foreground: 'onAccent' },
  { label: 'Report', description: 'Report an issue', href: '/reports', icon: 'warning-outline', tone: 'warning', foreground: 'onWarning' },
  { label: 'Emergency', description: 'Emergency information', href: '/drrm', icon: 'drrm', tone: 'danger', foreground: 'onDanger' },
  { label: 'Maps', description: 'Open barangay maps', href: '/maps', icon: 'location-outline', tone: 'info', foreground: 'onInfo' },
  { label: 'Health', description: 'Open health services', href: '/health', icon: 'heart-outline', tone: 'rose', foreground: 'onRose' },
] as const;

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
  const [requestRetry, setRequestRetry] = useState(0);
  const [announcementRetry, setAnnouncementRetry] = useState(0);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const requestKey = JSON.stringify([userId, requestRetry]);
  const [requestResult, setRequestResult] = useState<{ key: string; items: HomeRequest[]; error: string | null } | null>(null);
  const [newsResult, setNewsResult] = useState<{ retry: number; item: Announcement | null; error: string | null } | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<HomeRequest | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const pendingTracking = useRef<string | null>(null);
  const homeActive = useRef(true);
  const requestTargets = useRef(new Map<string, View>());
  // Pull-to-refresh re-runs each effect's own query under its current key; a failed pull keeps the cards on screen.
  const pullNews = useRef<(() => Promise<void>) | null>(null);
  const pullRequests = useRef<(() => Promise<void>) | null>(null);
  const pull = usePullRefresh([() => pullNews.current?.(), () => pullRequests.current?.(), refetchProfile]);

  useEffect(() => {
    let active = true;
    // Preserve the existing public latest-one query, including guest browsing. No new feed channel.
    const fetchLatest = () => Promise.resolve(supabase.from('announcements').select('*').order('published_at', { ascending: false }).limit(1));
    fetchLatest()
      .then(({ data, error }) => {
        if (active) setNewsResult({ retry: announcementRetry, item: data?.[0] ?? null, error: error ? 'Announcements could not be loaded. Please try again.' : null });
      }).catch(() => {
        if (active) setNewsResult({ retry: announcementRetry, item: null, error: 'Announcements could not be loaded. Please try again.' });
      });
    pullNews.current = () => fetchLatest().then(({ data, error }) => {
      if (!error && active) setNewsResult({ retry: announcementRetry, item: data?.[0] ?? null, error: null });
    }).catch(() => undefined);
    return () => { active = false; pullNews.current = null; };
  }, [announcementRetry]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Preserve the existing authenticated resident scope and latest-three limit.
    const fetchRecent = () => Promise.resolve(supabase.from('service_requests').select('*, document_types(name)').eq('resident_id', userId)
      .order('created_at', { ascending: false }).limit(3));
    fetchRecent()
      .then(({ data, error }) => {
        if (active) setRequestResult({ key: requestKey, items: (data as HomeRequest[]) ?? [], error: error ? 'Your requests could not be loaded. Please try again.' : null });
      }).catch(() => {
        if (active) setRequestResult({ key: requestKey, items: [], error: 'Your requests could not be loaded. Please try again.' });
      });
    pullRequests.current = () => fetchRecent().then(({ data, error }) => {
      if (!error && active) setRequestResult({ key: requestKey, items: (data as HomeRequest[]) ?? [], error: null });
    }).catch(() => undefined);
    return () => { active = false; pullRequests.current = null; };
  }, [userId, requestKey]);

  useEffect(() => {
    pendingTracking.current = null;
    setSheetOpen(false);
    setSelectedRequest(null);
  }, [userId]);

  useFocusEffect(useCallback(() => {
    homeActive.current = true;
    const listener = AppState.addEventListener('change', state => {
      homeActive.current = state === 'active';
      if (state !== 'active') { pendingTracking.current = null; setSheetOpen(false); }
    });
    return () => { homeActive.current = false; listener.remove(); pendingTracking.current = null; setSheetOpen(false); };
  }, []));

  const requests = requestResult?.key === requestKey ? requestResult : null;
  const news = newsResult?.retry === announcementRetry ? newsResult : null;
  const selected = selectedRequest?.resident_id === userId && userId ? selectedRequest : null;
  const firstName = profile?.full_name?.trim().split(/\s+/)[0] || 'Resident';
  const announcement = news?.item;
  const announcementTone = announcement?.category === 'emergency' ? resident.danger
    : announcement?.category === 'health' ? resident.rose : resident.accentText;

  function closeSheet() { pendingTracking.current = null; setSheetOpen(false); }
  function afterDismiss() {
    const id = pendingTracking.current;
    pendingTracking.current = null;
    if (!homeActive.current) return;
    // Keep tracking in Home's stack so Back removes it without changing Services.
    if (id && selected?.id === id) router.push(`/home/requests/${id}`);
    else {
      const target = selected ? requestTargets.current.get(selected.id) : null;
      if (target) { target.focus(); AccessibilityInfo.sendAccessibilityEvent(target, 'focus'); }
    }
  }

  return <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: resident.card }]}>
    <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomTabInset + 20 }]}
      refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}>
      <View style={styles.inset}><ProfileCompletionBanner /></View>
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
        <ThemedText accessibilityRole="header" style={[styles.greeting, { color: resident.text }]}>{homeGreeting(new Date().getHours())}, {userId ? firstName : 'neighbor'}</ThemedText>
      </View>
      <View style={styles.quickActions}>
        {QUICK_ACTIONS.map(action => <HomeAction key={action.label} reducedMotion={reducedMotion} pressScale={0.95}
          accessibilityLabel={action.label} accessibilityHint={action.description} onPress={() => router.push(action.href)} style={[styles.quickAction, compactActions && styles.compactAction]}>
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
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeading}>
            <ThemedText accessibilityRole="header" style={[styles.sectionTitle, { color: resident.text }]}>Your requests</ThemedText>
            <ThemedText style={[styles.subtitle, { color: resident.muted }]}>{requests && !requests.error ? `${requests.items.length} recent ${requests.items.length === 1 ? 'request' : 'requests'}` : 'Your latest requests'}</ThemedText>
          </View>
          <HomeAction reducedMotion={reducedMotion} accessibilityLabel="View all requests" onPress={() => router.push('/services')} style={styles.seeAll}>
            <ThemedText style={[styles.seeAllText, { color: resident.text }]}>See all</ThemedText>
          </HomeAction>
        </View>
        {!userId ? <View style={styles.inset}><GuestPrompt label="Log in to see your requests." /></View>
          : !requests ? <HomeListState loading label="Loading your requests…" />
          : requests.error ? <HomeListState label={requests.error} onRetry={() => setRequestRetry(value => value + 1)} />
          : requests.items.length === 0 ? <HomeListState label="Your requests will appear here. Tap Documents to request a document." />
          : <ScrollableChevronRow label="requests" snapToItems contentContainerStyle={styles.shelf}>
            {requests.items.map(request => {
              const summary = homeRequestSummary(request);
              const title = request.document_types?.name ?? 'Document request';
              return <HomeAction key={request.id} reducedMotion={reducedMotion}
                pressableRef={target => { if (target) requestTargets.current.set(request.id, target); else requestTargets.current.delete(request.id); }}
                accessibilityLabel={`${title}, reference ${request.reference_number}, ${summary.statusLabel}`}
                accessibilityHint="Opens a request summary" onPress={() => { pendingTracking.current = null; setSelectedRequest(request); setSheetOpen(true); }}
                style={({ pressed }) => [styles.requestCard, styles.card, { backgroundColor: pressed ? resident.pressed : resident.card, borderColor: resident.border }]}>
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
                  <View style={styles.segments} accessible={false} importantForAccessibility="no-hide-descendants">
                    {summary.steps.map((step, index) => <View key={step.status} style={[styles.segment, { backgroundColor: !summary.cancelled && index <= summary.stepIndex ? resident.accentText : resident.border }]} />)}
                  </View>
                  <ThemedText style={[styles.status, { color: summary.cancelled ? resident.danger : resident.text }]}>{summary.statusLabel}</ThemedText>
                </View>
              </HomeAction>;
            })}
          </ScrollableChevronRow>}
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
        {!news ? <HomeListState loading label="Loading announcements…" />
          : news.error ? <HomeListState label={news.error} onRetry={() => setAnnouncementRetry(value => value + 1)} />
          : announcement ? <View style={styles.shelf}>
            <HomeAction reducedMotion={reducedMotion} accessibilityLabel={`Read announcement: ${announcement.title}`}
              onPress={() => router.push({ pathname: '/announcements', params: { announcementId: announcement.id } })}
              style={({ pressed }) => [styles.announcementCard, styles.card, { backgroundColor: pressed ? resident.pressed : resident.card, borderColor: resident.border }]}>
              <View style={styles.newsMeta}>
                <View style={styles.categoryGroup}>
                  <View style={[styles.categoryDot, { backgroundColor: announcementTone }]} />
                  <ThemedText style={[styles.category, { color: announcementTone }]}>{announcement.category}</ThemedText>
                </View>
                <ThemedText style={[styles.newsDate, { color: resident.muted }]}>{homeTimestamp(announcement.published_at)}</ThemedText>
              </View>
              {announcement.image_url ? failedImage === announcement.image_url
                ? <ThemedText style={[styles.reference, { color: resident.muted }]}>Announcement image unavailable.</ThemedText>
                : <Image source={{ uri: announcement.image_url }} contentFit="cover" style={styles.announcementImage}
                    accessibilityLabel={`${announcement.title} image`} onError={() => setFailedImage(announcement.image_url)} />
                : null}
              <ThemedText style={[styles.cardTitle, styles.newsTitle, { color: resident.text }]}>{announcement.title}</ThemedText>
            </HomeAction>
          </View> : <HomeListState label="No announcements yet." />}
      </View>
    </ScrollView>
    {selected ? <RequestSummarySheet request={selected} visible={sheetOpen} reducedMotion={reducedMotion} onClose={closeSheet} onDismiss={afterDismiss}
      onViewFull={() => { pendingTracking.current = selected.id; setSheetOpen(false); }} /> : null}
  </SafeAreaView>;
}

function HomeListState({ label, loading = false, onRetry }: { label: string; loading?: boolean; onRetry?: () => void }) {
  const { resident } = useTheme();
  return <View style={[styles.listState, { backgroundColor: resident.surface }]} accessibilityLiveRegion="polite" accessibilityState={{ busy: loading }}>
    {loading ? <ActivityIndicator color={resident.accentText} /> : null}
    <ThemedText style={[styles.subtitle, { color: onRetry ? resident.danger : resident.muted }]}>{label}</ThemedText>
    {onRetry ? <PrimaryButton presentation="resident" variant="secondary" label="Try again" onPress={onRetry} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center' },
  inset: { paddingHorizontal: 20 },
  identitySection: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 20 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 36 },
  locationGroup: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontSize: 14, lineHeight: 20, fontWeight: '600', flexShrink: 1 },
  greeting: { marginTop: 12, fontSize: 28, lineHeight: 35, fontWeight: '800', letterSpacing: -0.7 },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, marginBottom: 28 },
  quickAction: { flex: 1, alignItems: 'center', paddingVertical: 4, gap: 6, minWidth: 0 },
  compactAction: { flex: 0, width: '33.333333%' },
  quickIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  quickLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600', textAlign: 'center', alignSelf: 'stretch' },
  section: { marginBottom: 28 },
  sectionHeader: { paddingHorizontal: 20, flexDirection: 'row', alignItems: 'flex-end', gap: 16, marginBottom: 12 },
  sectionHeading: { flex: 1, minWidth: 0 },
  sectionTitle: { fontSize: 21, lineHeight: 26.25, fontWeight: '800', letterSpacing: -0.525 },
  subtitle: { fontSize: 13, lineHeight: 19.5, marginTop: 2 },
  seeAll: { minHeight: 44, justifyContent: 'flex-end' },
  seeAllText: { fontSize: 14, lineHeight: 20, fontWeight: '600', textDecorationLine: 'underline' },
  shelf: { flexDirection: 'row', paddingHorizontal: 20, paddingBottom: 12, gap: 12, alignItems: 'stretch' },
  card: { borderRadius: 12, borderWidth: 1, padding: 12, shadowColor: '#000', shadowOpacity: 0.035, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  requestCard: { width: 244, flexGrow: 1 },
  requestTop: { flexDirection: 'row', gap: 10 },
  requestIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  requestInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 14, lineHeight: 18, fontWeight: '700', minHeight: 36 },
  reference: { fontSize: 11.5, lineHeight: 17.25, marginTop: 2 },
  requestProgress: { marginTop: 'auto', paddingTop: 10 },
  segments: { flexDirection: 'row', gap: 4 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  status: { marginTop: 6, fontSize: 11.5, lineHeight: 17.25, fontWeight: '700' },
  announcementCard: { width: 232, maxWidth: '100%', gap: 6 },
  announcementImage: { width: '100%', aspectRatio: 2.4, borderRadius: 8 },
  newsTitle: { fontWeight: '600' },
  newsMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryGroup: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 },
  newsDate: { fontSize: 11.5, lineHeight: 17.25, textAlign: 'right', flexShrink: 1 },
  categoryDot: { width: 6, height: 6, borderRadius: 3 },
  category: { fontSize: 11.5, lineHeight: 17.25, fontWeight: '700', textTransform: 'capitalize', flexShrink: 1 },
  listState: { marginHorizontal: 20, borderRadius: 12, padding: 16, gap: 12 },
});
