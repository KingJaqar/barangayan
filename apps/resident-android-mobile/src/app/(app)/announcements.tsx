import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory } from '@barangayan/shared';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FilterChips, type FilterChip } from '@/components/filter-chips';
import { GuestPrompt } from '@/components/guest-prompt';
import { HubCards } from '@/components/notifications/hub-cards';
import { NotificationDetailSheet, type DetailTarget } from '@/components/notifications/notification-detail-sheet';
import { NotificationRow } from '@/components/notifications/notification-row';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { AnnouncementCard } from '@/components/reports/announcement-card';
import { AnnouncementModal } from '@/components/reports/announcement-modal';
import { ReadAction, ReportSourceState } from '@/components/reports/report-presentation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useNotificationHub } from '@/hooks/use-notification-hub';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import { HUB_CHIPS, cardUnread, notificationOpen, scopeUnread, type HubSource, type HubView } from '@/lib/notification-hub';
import { fetchAnnouncement, fetchInboxItem, type Announcement, type InboxItem } from '@/lib/notification-hub-data';

type Edge = 'first' | 'middle' | 'last' | 'only';
type ListItem =
  | { key: string; type: 'chips' }
  | { key: string; type: 'header'; source: HubSource; count: number | null; collapsed: boolean }
  | { key: string; type: 'announcement'; item: Announcement; edge: Edge }
  | { key: string; type: 'inbox'; item: InboxItem; edge: Edge }
  | { key: string; type: 'state'; message: string; retry?: () => void }
  | { key: string; type: 'more'; source: HubSource; fetching: boolean; onPress: () => void }
  | { key: string; type: 'guest' };

const GROUP_LABELS: Record<HubSource, string> = { barangay: 'Barangay', account: 'Account', system: 'System' };
const MORE_LABELS: Record<HubSource, string> = { barangay: 'Load older announcements', account: 'Load older account notifications', system: 'Load older system notices' };
const EMPTY_MESSAGES: Record<HubView, [string, string]> = {
  all: ['Nothing here in this category yet.', 'Nothing here yet.'],
  barangay: ['No announcements in this category.', 'No announcements yet.'],
  account: ['No account notifications in this category.', 'No account notifications yet.'],
  system: ['No system notices in this category.', 'No system notices yet.'],
};
const edgeOf = (index: number, length: number): Edge => length === 1 ? 'only' : index === 0 ? 'first' : index === length - 1 ? 'last' : 'middle';

function unreadText(signedIn: boolean, unread: number | null, loading: boolean): string | null {
  if (!signedIn) return null;
  if (unread === null) return loading ? 'Checking unread…' : 'Unread count unavailable';
  return unread > 0 ? `${unread} unread` : 'You’re all caught up';
}

export default function AnnouncementsScreen() {
  const { resident, primary } = useTheme();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const bottom = useFloatingTabInset();
  const { announcementId, notificationId } = useLocalSearchParams<{ announcementId?: string; notificationId?: string }>();
  const [scope, setScope] = useState<{ view: HubView; chip: string }>({ view: 'all', chip: 'all' });
  const privateScope = scope.view === 'account' || scope.view === 'system' || scope.chip === 'account' || scope.chip === 'system';
  const { view, chip } = !session && privateScope ? { view: 'all' as const, chip: 'all' } : scope;
  useEffect(() => {
    if (!session && privateScope) setScope({ view: 'all', chip: 'all' });
  }, [session, privateScope]);
  const [collapsed, setCollapsed] = useState<ReadonlySet<HubSource>>(new Set());
  const hub = useNotificationHub(view, chip);
  const { groups, listed, signedIn, summary, refreshAll, invalidateAll } = hub;
  const pull = usePullRefresh([refreshAll]);
  const { unreadAnnouncementIds, markAnnouncementRead, markHubScopeRead, markInboxRead, readStateError, retryReadState } = useUnreadCounts();
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [readError, setReadError] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [loadFailed, setLoadFailed] = useState<(() => void) | null>(null);
  const opening = useRef<string | null>(null);

  const chips = useMemo<FilterChip<string>[]>(() => HUB_CHIPS[view].filter(({ key }) => signedIn || (key !== 'account' && key !== 'system')).map(({ key, label }) => ({
    key, label, color: key in ANNOUNCEMENT_CATEGORY_META ? ANNOUNCEMENT_CATEGORY_META[key as AnnouncementCategory].color : primary,
  })), [view, primary, signedIn]);

  const openAnnouncement = useCallback((item: Announcement) => {
    if (opening.current === item.id) return;
    opening.current = item.id;
    setUnavailable(false); setLoadFailed(null); setReadError(false); setSelected(item); setAnnouncementVisible(true);
    if (unreadAnnouncementIds.includes(item.id)) void markAnnouncementRead(item.id).catch(() => setReadError(true));
  }, [unreadAnnouncementIds, markAnnouncementRead]);

  // A failed fetch is retryable; only a confirmed missing row reads "no longer available".
  const loadThenOpen = useCallback(<T,>(load: (signal: AbortSignal) => Promise<T | null>, open: (row: T) => void, isActive: () => boolean = () => true, onSettled?: () => void) => {
    const attempt = (stillActive: () => boolean) => {
      setUnavailable(false); setLoadFailed(null);
      load(new AbortController().signal).then(row => {
        if (!stillActive()) return;
        if (row) open(row); else setUnavailable(true);
        onSettled?.();
      }, () => {
        if (!stillActive()) return;
        setLoadFailed(() => () => attempt(() => true));
        onSettled?.();
      });
    };
    attempt(isActive);
  }, []);

  const openInbox = useCallback(async (item: InboxItem) => {
    const target = notificationOpen(item.destination);
    setUnavailable(false); setLoadFailed(null); setReadError(false);
    if (target.type === 'announcement') {
      // The announcement's own read marker is canonical (D05); the bridge mirrors it into this row.
      loadThenOpen(signal => fetchAnnouncement(signal, target.id), openAnnouncement);
      return;
    }
    if (item.read_at === null) void markInboxRead(item.id, true).catch(() => setReadError(true)).finally(() => { void invalidateAll(); });
    if (target.type === 'record') { router.push(target.route as Href); return; }
    setDetail({ item, noticeId: target.noticeId, action: target.action }); setDetailVisible(true);
  }, [markInboxRead, openAnnouncement, invalidateAll, loadThenOpen]);

  const toggleInboxRead = useCallback(async (item: InboxItem) => {
    try { await markInboxRead(item.id, item.read_at === null); } finally { void invalidateAll(); }
  }, [markInboxRead, invalidateAll]);

  // Deep links resolve against the owner's data, not the loaded pages. Only an unmount or a new id cancels the read.
  const latest = useRef({ openAnnouncement, openInbox });
  useEffect(() => { latest.current = { openAnnouncement, openInbox }; });
  useEffect(() => {
    if (!announcementId) return;
    let active = true;
    loadThenOpen(signal => fetchAnnouncement(signal, announcementId), row => latest.current.openAnnouncement(row), () => active, () => router.setParams({ announcementId: undefined }));
    return () => { active = false; };
  }, [announcementId, loadThenOpen]);
  useEffect(() => {
    if (!notificationId || !userId) return;
    let active = true;
    loadThenOpen(signal => fetchInboxItem(signal, notificationId, userId), row => { void latest.current.openInbox(row); }, () => active, () => router.setParams({ notificationId: undefined }));
    return () => { active = false; };
  }, [notificationId, userId, loadThenOpen]);

  const markAll = useCallback(async () => {
    try { await markHubScopeRead(view, chip); } finally { void invalidateAll(); }
  }, [markHubScopeRead, invalidateAll, view, chip]);

  const showHeaders = listed.length > 1;
  const items = useMemo<ListItem[]>(() => {
    const out: ListItem[] = [{ key: 'chips', type: 'chips' }];
    if (listed.length === 0) return [...out, { key: 'guest', type: 'guest' }];
    let confirmedEmpty = 0;
    for (const source of listed) {
      const group = groups[source];
      const rows = group.data?.rows ?? [];
      if (group.data && rows.length === 0 && !group.error) { confirmedEmpty++; continue; }
      const isCollapsed = collapsed.has(source);
      if (showHeaders) out.push({ key: `header:${source}`, type: 'header', source, count: group.data?.total ?? null, collapsed: isCollapsed });
      if (isCollapsed) continue;
      if (group.loading) out.push({ key: `state:${source}`, type: 'state', message: 'Loading…' });
      rows.forEach((row, index) => {
        const edge = edgeOf(index, rows.length);
        if (source === 'barangay') out.push({ key: `announcement:${row.id}`, type: 'announcement', item: row as Announcement, edge });
        else out.push({ key: `inbox:${row.id}`, type: 'inbox', item: row as InboxItem, edge });
      });
      if (group.error) out.push({ key: `state:${source}`, type: 'state', message: group.error, retry: () => { void group.refresh(); } });
      if (group.data?.hasMore) out.push({ key: `more:${source}`, type: 'more', source, fetching: group.fetching, onPress: () => { void group.loadMore(); } });
    }
    if (confirmedEmpty === listed.length) out.push({ key: 'state:empty', type: 'state', message: EMPTY_MESSAGES[view][chip === 'all' ? 1 : 0] });
    return out;
  }, [listed, groups, collapsed, showHeaders, view, chip]);

  const unreadByCard = {
    all: summary ? cardUnread(summary, 'all') : null, barangay: summary ? cardUnread(summary, 'barangay') : null,
    account: summary ? cardUnread(summary, 'account') : null, system: summary ? cardUnread(summary, 'system') : null,
  };
  const scoped = summary ? scopeUnread(summary, listed) : null;
  const summaryText = unreadText(signedIn, scoped, summary === null && !hub.summaryError);

  const header = <View>
    <HubCards active={view} unread={unreadByCard} signedIn={signedIn} onSelect={next => { if (next !== view) setScope({ view: next, chip: 'all' }); }} />
    {signedIn ? <View style={styles.summary}>
      <ThemedText accessibilityLiveRegion="polite" style={[styles.count, { color: resident.muted }]}>{summaryText}</ThemedText>
      <ReadAction inline label="Mark all as read" action={markAll} disabled={scoped === null || scoped === 0} />
    </View> : null}
    {readStateError ? <ReportSourceState message="Read status could not be refreshed." retry={retryReadState} retryLabel="Retry read status" /> : null}
    {unavailable ? <ReportSourceState message="This item is no longer available." /> : null}
    {loadFailed ? <ReportSourceState message="This item could not be loaded. Check your connection and try again." retry={loadFailed} retryLabel="Retry loading item" /> : null}
    {readError ? <ReportSourceState message="The item opened, but its read status could not be saved. Use its read control to try again." /> : null}
  </View>;

  const renderItem = ({ item }: { item: ListItem }) => {
    switch (item.type) {
      case 'chips': return <View style={{ backgroundColor: resident.card }}><FilterChips chips={chips} active={chip} onSelect={next => setScope({ view, chip: next })} /></View>;
      case 'header': return <Pressable accessibilityRole="button" accessibilityState={{ expanded: !item.collapsed }}
        accessibilityLabel={`${GROUP_LABELS[item.source]}${item.count === null ? '' : `, ${item.count}`}, ${item.collapsed ? 'collapsed' : 'expanded'}`}
        onPress={() => setCollapsed(current => { const next = new Set(current); if (!next.delete(item.source)) next.add(item.source); return next; })}
        style={styles.groupHeader}>
        <ThemedText style={[styles.groupTitle, { color: resident.text }]}>{GROUP_LABELS[item.source]}{item.count === null ? '' : ` · ${item.count}`}</ThemedText>
        <Ionicons name={item.collapsed ? 'chevron-down' : 'chevron-up'} size={18} color={resident.muted} accessible={false} />
      </Pressable>;
      case 'announcement': return <Panel edge={item.edge}><AnnouncementCard announcement={item.item} onPress={() => openAnnouncement(item.item)} /></Panel>;
      case 'inbox': return <Panel edge={item.edge}><NotificationRow item={item.item} onPress={() => { void openInbox(item.item); }} onToggleRead={toggleInboxRead} /></Panel>;
      case 'state': return <ReportSourceState message={item.message} retry={item.retry} />;
      case 'more': return <View style={styles.more}><PrimaryButton presentation="resident" variant="secondary" label={MORE_LABELS[item.source]}
        accessibilityLabel={MORE_LABELS[item.source]} loading={item.fetching} onPress={item.onPress} /></View>;
      case 'guest': return <View style={styles.guest}><GuestPrompt label={view === 'system' ? 'Log in to see system notices.' : 'Log in to see your account notifications.'} /></View>;
    }
  };

  // One scroll owner: the cards and summary scroll away as the list header, and the chips row (the first data item,
  // sticky index 1 because the header cell is index 0) stays pinned.
  return <View style={[styles.root, { backgroundColor: resident.card }]}>
    <FlatList data={items} keyExtractor={item => item.key} renderItem={renderItem} ListHeaderComponent={header}
      stickyHeaderIndices={[1]} extraData={chips}
      refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
      contentContainerStyle={{ paddingBottom: bottom + 16 }} />
    <AnnouncementModal visible={announcementVisible} announcement={selected} readError={readError}
      onClose={() => { opening.current = null; setAnnouncementVisible(false); }} />
    <NotificationDetailSheet target={detail} visible={detailVisible} readError={readError}
      onClose={() => setDetailVisible(false)}
      onAction={route => { setDetailVisible(false); router.navigate(route as Href); }} />
  </View>;
}

function Panel({ edge, children }: { edge: Edge; children: ReactNode }) {
  const { resident } = useTheme();
  const top = edge === 'first' || edge === 'only';
  const bottomEdge = edge === 'last' || edge === 'only';
  return <View style={[styles.panel, {
    borderColor: resident.border, borderBottomWidth: bottomEdge ? 1 : 0,
    borderTopLeftRadius: top ? 16 : 0, borderTopRightRadius: top ? 16 : 0,
    borderBottomLeftRadius: bottomEdge ? 16 : 0, borderBottomRightRadius: bottomEdge ? 16 : 0,
  }]}>{children}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, columnGap: 8 },
  count: { flexGrow: 1, flexShrink: 1, flexBasis: 140, fontSize: 12.5, lineHeight: 18, includeFontPadding: false },
  groupHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8 },
  groupTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  panel: { marginHorizontal: 16, borderLeftWidth: 1, borderRightWidth: 1, borderTopWidth: 1, overflow: 'hidden' },
  more: { paddingHorizontal: 16, paddingTop: 8 },
  guest: { paddingHorizontal: 16, paddingTop: 8 },
});
