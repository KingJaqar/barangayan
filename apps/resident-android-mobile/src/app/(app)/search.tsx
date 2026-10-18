import { router, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Keyboard, Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useResidentSearch, useSearchDraft } from '@/hooks/use-resident-search';
import { useTheme } from '@/hooks/use-theme';
import { SEARCH_SOURCES, type SearchResult } from '@/lib/resident-search';
import { searchSuggestions } from '@/lib/search-history';

function openResult(result: SearchResult) {
  Keyboard.dismiss();
  switch (result.category) {
    case 'documents': router.push(`/services/${result.id}` as Href); break;
    case 'requests': router.push(`/services/requests/${result.id}` as Href); break;
    case 'reports': router.push(`/reports/${result.id}` as Href); break;
    case 'help': router.push(`/settings/help/${result.id}` as Href); break;
    case 'announcements': router.navigate({ pathname: '/announcements', params: { announcementId: result.id } }); break;
    case 'health': router.navigate({ pathname: '/health', params: { searchDate: result.date } }); break;
  }
}
export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { query, groups, loading, error, enabled, retry } = useResidentSearch();
  const { history, historyError, selectSearch, rememberSearch, removeSearch, clearHistory } = useSearchDraft();
  const suggestions = searchSuggestions(query, history, groups.flatMap(group => group.results.map(result => result.title)))
    .filter(item => query || !item.recent);
  const failed = groups.some(group => group.failed);
  const sections = groups.filter(group => group.results.length > 0).map(group => ({ ...group, title: SEARCH_SOURCES[group.category].label, data: group.results }));
  return <View style={[styles.root, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 12), paddingLeft: insets.left, paddingRight: insets.right }]}>
    <View accessibilityLiveRegion="polite" style={styles.status}>
      <ThemedText type="small" themeColor="textSecondary">{!enabled ? 'Search services, announcements, medical drives, help, and your records.' : loading ? 'Searching…' : error ?? (sections.length ? `Results for “${query}”` : failed ? 'Some sources could not be searched.' : `No results for “${query}”. Try different words.`)}</ThemedText>
      {loading ? <ActivityIndicator color={theme.primary} /> : null}
      {failed || error ? <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}><ThemedText style={{ color: theme.primary }}>Retry search</ThemedText></Pressable> : null}
      {failed && sections.length ? <ThemedText type="small">Some sources are unavailable. Results may be incomplete.</ThemedText> : null}
    </View>
    <SectionList sections={sections} keyExtractor={item => `${item.category}:${item.id}`} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" stickySectionHeadersEnabled={false} contentContainerStyle={styles.list}
      ListHeaderComponent={<View>
        {historyError ? <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">{historyError}</ThemedText> : null}
        {!query && history.length > 0 ? <View>
          <View style={styles.heading}>
            <ThemedText type="smallBold" accessibilityRole="header">Recent searches</ThemedText>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear all recent searches" onPress={clearHistory} style={styles.clearAll}>
              <ThemedText type="small" style={{ color: theme.primary }}>Clear all</ThemedText>
            </Pressable>
          </View>
          {history.map(label => <View key={label.toLowerCase()} style={styles.suggestionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Search again for ${label}`} onPress={() => { selectSearch(label); Keyboard.dismiss(); }} style={styles.suggestion}>
              <Ionicons name="time-outline" size={22} color={theme.textSecondary} />
              <ThemedText style={styles.suggestionLabel} numberOfLines={2}>{label}</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label} from recent searches`} onPress={() => removeSearch(label)} style={styles.remove}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable>
          </View>)}
        </View> : null}
        {suggestions.length > 0 ? <View>
          <ThemedText type="smallBold" accessibilityRole="header" style={styles.section}>{query ? 'Suggestions' : 'Suggested searches'}</ThemedText>
          {suggestions.map(({ label, recent }) => <View key={label.toLowerCase()} style={styles.suggestionRow}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Search for ${label}`} onPress={() => { selectSearch(label); Keyboard.dismiss(); }} style={styles.suggestion}>
              <Ionicons name={recent ? 'time-outline' : 'search-outline'} size={22} color={theme.textSecondary} />
              <ThemedText style={styles.suggestionLabel} numberOfLines={2}>{label}</ThemedText>
            </Pressable>
            {recent ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label} from recent searches`} onPress={() => removeSearch(label)} style={styles.remove}>
              <Ionicons name="close" size={20} color={theme.textSecondary} />
            </Pressable> : null}
          </View>)}
        </View> : null}
      </View>}
      renderSectionHeader={({ section }) => <View style={styles.section}><ThemedText type="smallBold">{section.title}</ThemedText>{section.more ? <ThemedText type="small" themeColor="textSecondary">First 20 matches · refine your search for more</ThemedText> : null}</View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => { rememberSearch(query); openResult(item); }} style={[styles.result, { borderColor: theme.backgroundSelected, backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">{item.title}</ThemedText>
        {item.date ? <ThemedText type="small">{item.date}</ThemedText> : null}
        {item.preview ? <ThemedText type="small" numberOfLines={3} themeColor="textSecondary">{item.preview}</ThemedText> : null}
      </Pressable>} />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, status: { padding: 16, gap: 12 }, retry: { minHeight: 48, justifyContent: 'center' },
  list: { paddingHorizontal: 16, paddingBottom: 16 }, section: { paddingTop: 16, paddingBottom: 8, gap: 4 },
  result: { padding: 16, borderWidth: 1, borderRadius: 16, marginBottom: 8, gap: 6 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  clearAll: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center' },
  suggestion: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  suggestionLabel: { flex: 1 },
  remove: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
