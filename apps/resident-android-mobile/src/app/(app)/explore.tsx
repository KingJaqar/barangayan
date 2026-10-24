import { Ionicons } from '@expo/vector-icons';
import { router, useNavigation, type Href } from 'expo-router';
import { useEffect, useRef, useState, useSyncExternalStore, type ComponentProps } from 'react';
import { ActivityIndicator, Keyboard, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScrollableChevronRow } from '@/components/scrollable-chevron-row';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useSearchDraft } from '@/hooks/use-resident-search';
import { useTheme } from '@/hooks/use-theme';
import { queryResidentSearchPage, searchCategories, SEARCH_SOURCES, type SearchCategory, type SearchFailure, type SearchResult } from '@/lib/resident-search';
import { createSearchResults, type SearchResultsState } from '@/lib/search-results';
import { supabase } from '@/lib/supabase';

type Tab = 'all' | SearchCategory;
type Results = ReturnType<typeof createSearchResults>;
const PREVIEWS = 3;
const ICONS: Record<SearchCategory, ComponentProps<typeof Ionicons>['name']> = {
  documents: 'document-text-outline', announcements: 'megaphone-outline', health: 'medkit-outline',
  help: 'help-circle-outline', requests: 'clipboard-outline', reports: 'warning-outline',
};
const FAILURES: Record<SearchFailure, string> = {
  denied: 'You do not have access to these results.',
  offline: 'You appear to be offline. Check your connection and try again.',
  timeout: 'Search took too long. Please try again.',
  unavailable: 'Search is unavailable right now. Please try again.',
};
const IDLE: SearchResultsState = { query: '', status: 'idle', categories: [] };
const unsubscribed = () => () => {};
const idle = () => IDLE;

/** Detail results live in another tab's stack; the rest are tab screens that Back already returns from. */
const STACK_RESULTS: Partial<Record<SearchCategory, { tab: string; href: (id: string) => string }>> = {
  documents: { tab: 'services', href: id => `/services/${id}` },
  requests: { tab: 'services', href: id => `/services/requests/${id}` },
  reports: { tab: 'reports', href: id => `/reports/${id}` },
  help: { tab: 'settings', href: id => `/settings/help/${id}` },
};
type OpenedResult = { tab: string; id: string; detail?: string; below?: string };

/** Submitted results: All previews each eligible source; a category tab or See all pages through one source. */
export default function ExploreScreen() {
  const theme = useTheme();
  const { resident } = theme;
  const insets = useSafeAreaInsets();
  const { submittedQuery, submission } = useSearchDraft();
  const { session } = useAuth();
  // Foreground and realtime profile refreshes keep the profile; only a first load holds the search.
  const { profile, isInitialLoading } = useProfile();
  const userId = session?.user.id ?? null;
  const barangayId = profile?.barangay_id ?? null;
  const ready = submittedQuery !== null && !(userId && isInitialLoading);
  // Every accepted submission (even of the same query) and every account scope gets fresh results, All, page 1 and top scroll.
  const key = JSON.stringify([submission, submittedQuery, userId, barangayId]);
  const [owned, setOwned] = useState<{ key: string; results: Results } | null>(null);
  useEffect(() => {
    if (!ready || submittedQuery === null) return;
    const scope = { userId, barangayId };
    const results = createSearchResults(submittedQuery, searchCategories(scope),
      (category, offset, signal) => queryResidentSearchPage(supabase, scope, category, submittedQuery, offset, signal));
    setOwned({ key, results });
    results.start();
    return () => results.dispose();
  }, [key, ready, submittedQuery, userId, barangayId]);
  const results = owned?.key === key ? owned.results : null;
  const state = useSyncExternalStore(results?.subscribe ?? unsubscribed, results?.getState ?? idle);
  // A stack result opens above that tab's own screens (anchored on its index), so Back alone would
  // stop there. When the opened detail is popped back to the screen beneath it, continue back here.
  const navigation = useNavigation();
  const opened = useRef<OpenedResult | null>(null);
  // Stack details hide the shared header, so this list grows while it is covered and Android clamps an
  // offset near its end. The offset captured on open is put back once the list is its old height again.
  const list = useRef<SectionList<SearchResult, { category: SearchCategory }>>(null);
  const scrolled = useRef(0);
  const height = useRef(0);
  const restore = useRef<{ offset: number; height: number; grown: boolean } | null>(null);
  useEffect(() => navigation.addListener('state', ({ data }) => {
    const pending = opened.current;
    const tab = data.state.routes[data.state.index];
    if (!pending || !tab) return;
    if (tab.name !== pending.tab) {
      // Still here before the navigation lands; anywhere else means the resident moved on.
      if (tab.name !== 'explore' || pending.detail) opened.current = restore.current = null;
      return;
    }
    const routes = tab.state?.routes ?? [];
    const index = tab.state?.index ?? routes.length - 1;
    const top = routes[index];
    if (!pending.detail) {
      if (top?.key && Object.values(top.params ?? {}).includes(pending.id)) opened.current = { ...pending, detail: top.key, below: routes[index - 1]?.key };
      return;
    }
    if (routes.some(route => route.key === pending.detail)) return;
    opened.current = null;
    if (pending.below && top?.key === pending.below) navigation.goBack();
    else restore.current = null;
  }), [navigation]);
  const openResult = (result: SearchResult) => {
    Keyboard.dismiss();
    const stack = STACK_RESULTS[result.category];
    opened.current = stack ? { tab: stack.tab, id: result.id } : null;
    restore.current = stack ? { offset: scrolled.current, height: height.current, grown: false } : null;
    if (stack) router.push(stack.href(result.id) as Href, { withAnchor: true });
    else if (result.category === 'announcements') router.navigate({ pathname: '/announcements', params: { announcementId: result.id } });
    else router.navigate({ pathname: '/health', params: { searchDate: result.date } });
  };
  const [selection, setSelection] = useState<{ key: string; tab: Tab }>({ key, tab: 'all' });
  const tab = selection.key === key ? selection.tab : 'all';
  const select = (next: Tab) => setSelection({ key, tab: next });
  // See all can select a tab scrolled out of view; the row follows the selection.
  const [activeTab, setActiveTab] = useState<{ x: number; width: number }>();
  const categories = searchCategories({ userId, barangayId });
  const label = (category: SearchCategory) => SEARCH_SOURCES[category].label;
  const quoted = `“${submittedQuery ?? ''}”`;
  const focused = tab === 'all' ? null : state.categories.find(entry => entry.category === tab) ?? null;
  const sections = tab === 'all'
    ? state.categories.filter(entry => entry.results.length).map(entry => ({ category: entry.category, data: entry.results.slice(0, PREVIEWS) }))
    : focused?.results.length ? [{ category: focused.category, data: focused.results }] : [];
  const searching = submittedQuery !== null && (!results || (tab === 'all' ? state.status === 'loading' : Boolean(focused?.loading && !focused.results.length)));
  const failed = state.categories.filter(entry => entry.failure);

  const notice = (text: string, retry?: () => void, retryLabel = 'Try again') => <View accessibilityLiveRegion="polite" style={styles.notice}>
    <ThemedText type="small" style={{ color: resident.muted }}>{text}</ThemedText>
    {retry ? <Pressable accessibilityRole="button" accessibilityLabel={retryLabel} onPress={retry} style={styles.action}>
      <ThemedText type="smallBold" style={{ color: resident.accentText }}>Try again</ThemedText>
    </Pressable> : null}
  </View>;
  let status = null;
  if (submittedQuery === null) status = notice('Enter a search to explore results.');
  else if (searching) status = <View accessibilityLiveRegion="polite" style={styles.searching}>
    <ActivityIndicator color={resident.accentText} />
    <ThemedText type="small" style={{ color: resident.muted }}>Searching…</ThemedText>
  </View>;
  else if (tab === 'all' && state.status === 'failed') status = notice(FAILURES[failed[0]?.failure ?? 'unavailable'], () => results?.retry(), 'Try searching again');
  else if (tab === 'all' && state.status === 'partial') status = notice(`${failed.map(entry => label(entry.category)).join(', ')} could not be searched. Results may be incomplete.`, () => results?.retry(), 'Try the unavailable sources again');
  else if (tab === 'all' && state.status === 'ready' && !sections.length) status = notice(`No results for ${quoted}. Try different words.`);
  else if (focused?.failure && !focused.results.length) status = notice(FAILURES[focused.failure], () => results?.retry(focused.category), `Try searching ${label(focused.category)} again`);
  else if (focused && focused.pages && !focused.results.length) status = notice(`No ${label(focused.category).toLowerCase()} match ${quoted}.`);

  const footer = focused?.results.length ? focused.loading
    ? <View accessibilityLiveRegion="polite" style={styles.searching}><ActivityIndicator color={resident.accentText} /><ThemedText type="small" style={{ color: resident.muted }}>Loading more…</ThemedText></View>
    : focused.failure ? notice(`More results could not be loaded. ${FAILURES[focused.failure]}`, () => results?.retry(focused.category), `Try loading more ${label(focused.category)} again`)
    : focused.more ? <Pressable accessibilityRole="button" accessibilityLabel={`Load more ${label(focused.category)}`} onPress={() => results?.loadMore(focused.category)}
        style={({ pressed }) => [styles.loadMore, { backgroundColor: pressed ? resident.pressed : resident.surface }]}>
        <ThemedText type="smallBold" style={{ color: resident.accentText }}>Load more</ThemedText>
      </Pressable>
    : <ThemedText type="small" style={[styles.end, { color: resident.muted }]}>No more results</ThemedText> : null;

  return <View style={[styles.root, { backgroundColor: theme.background, paddingLeft: insets.left, paddingRight: insets.right }]}>
    {submittedQuery !== null ? <ScrollableChevronRow label="search categories" contentContainerStyle={styles.tabs} reveal={activeTab}>
      <SegmentedControl variant="underline" sizing="content" presentation="resident" activeKey={tab} onChange={select} onActiveLayout={setActiveTab}
        segments={[{ key: 'all' as Tab, label: 'All' }, ...categories.map(category => ({ key: category as Tab, label: label(category) }))]} />
    </ScrollableChevronRow> : null}
    <SectionList ref={list} key={`${key}:${tab}`} sections={sections} keyExtractor={item => `${item.category}:${item.id}`}
      onScroll={event => { scrolled.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={16}
      onScrollBeginDrag={() => { restore.current = null; }}
      onLayout={event => {
        height.current = event.nativeEvent.layout.height;
        const pending = restore.current;
        if (!pending) return;
        if (height.current !== pending.height) pending.grown = true;
        else if (pending.grown) {
          list.current?.getScrollResponder()?.scrollTo({ y: pending.offset, animated: false });
          restore.current = null;
        }
      }}
      keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" stickySectionHeadersEnabled={false}
      contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
      ListHeaderComponent={status} ListFooterComponent={footer}
      renderSectionHeader={({ section }) => tab === 'all' ? <View style={styles.sectionHeader}>
        <ThemedText type="smallBold" accessibilityRole="header" style={[styles.sectionTitle, { color: resident.text }]}>{label(section.category)}</ThemedText>
        <Pressable accessibilityRole="button" accessibilityLabel={`See all ${label(section.category)}`} onPress={() => select(section.category)} style={styles.action}>
          <ThemedText type="smallBold" style={{ color: resident.accentText }}>See all</ThemedText>
        </Pressable>
      </View> : null}
      renderItem={({ item }) => <ResultRow result={item} onOpen={openResult} />} />
  </View>;
}

function ResultRow({ result, onOpen }: { result: SearchResult; onOpen: (result: SearchResult) => void }) {
  const { resident } = useTheme();
  const detail = [result.date, result.preview].filter(Boolean).join(' · ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`${result.title}, ${SEARCH_SOURCES[result.category].label}`}
    accessibilityHint={detail || undefined} onPress={() => onOpen(result)}
    style={({ pressed }) => [styles.result, pressed && { backgroundColor: resident.pressed }]}>
    <View style={[styles.icon, { backgroundColor: resident.accentSoft }]}>
      <Ionicons name={ICONS[result.category]} size={22} color={resident.accentText} accessible={false} />
    </View>
    <View style={styles.resultText}>
      <ThemedText type="smallBold" numberOfLines={2} style={{ color: resident.text }}>{result.title}</ThemedText>
      {detail ? <ThemedText type="small" numberOfLines={2} style={{ color: resident.muted }}>{detail}</ThemedText> : null}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  tabs: { paddingHorizontal: 16 },
  list: { paddingHorizontal: 16 },
  notice: { paddingVertical: 16, gap: 4 },
  searching: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 16 },
  action: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignSelf: 'flex-start' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingTop: 16 },
  sectionTitle: { flex: 1, fontSize: 16, lineHeight: 22 },
  result: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8, borderRadius: 12 },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  resultText: { flex: 1, minWidth: 0, gap: 2 },
  loadMore: { minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  end: { textAlign: 'center', paddingVertical: 16 },
});
