import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { useResidentSearch, useSearchDraft } from '@/hooks/use-resident-search';
import { useTheme } from '@/hooks/use-theme';
import { searchSuggestions } from '@/lib/search-history';

export default function SearchScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Live matches only feed typed suggestions; submitted results belong to Explore.
  const { query, groups, loading } = useResidentSearch();
  const { history, historyError, reloadHistory, submitSearch, removeSearch, clearHistory } = useSearchDraft();
  // Empty entry lists recents in their own section, so they must not use up the suggestion slots.
  const suggestions = searchSuggestions(query, query ? history : [], groups.flatMap(group => group.results.map(result => result.title)));
  return <View style={[styles.root, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, 12), paddingLeft: insets.left, paddingRight: insets.right }]}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.list}>
      {historyError ? <View accessibilityLiveRegion="polite" style={styles.heading}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.suggestionLabel}>{historyError === 'load' ? 'Recent searches could not be loaded.' : 'Recent searches could not be updated. Please try again.'}</ThemedText>
        {historyError === 'load' ? <Pressable accessibilityRole="button" accessibilityLabel="Try loading recent searches again" onPress={reloadHistory} style={styles.clearAll}>
          <ThemedText type="small" style={{ color: theme.primary }}>Try again</ThemedText>
        </Pressable> : null}
      </View> : null}
      {!query && history.length > 0 ? <View>
        <View style={styles.heading}>
          <ThemedText type="smallBold" accessibilityRole="header">Recent searches</ThemedText>
          <Pressable accessibilityRole="button" accessibilityLabel="Clear all recent searches" onPress={clearHistory} style={styles.clearAll}>
            <ThemedText type="small" style={{ color: theme.primary }}>Clear all</ThemedText>
          </Pressable>
        </View>
        {history.map(label => <View key={label.toLowerCase()} style={styles.suggestionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Search again for ${label}`} onPress={() => submitSearch(label)} style={styles.suggestion}>
            <Ionicons name="time-outline" size={22} color={theme.textSecondary} />
            <ThemedText style={styles.suggestionLabel} numberOfLines={2}>{label}</ThemedText>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label} from recent searches`} onPress={() => removeSearch(label)} style={styles.remove}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>)}
      </View> : null}
      {loading ? <ActivityIndicator accessibilityLabel="Finding matching suggestions" color={theme.primary} style={styles.loading} /> : null}
      {suggestions.length > 0 ? <View>
        <ThemedText type="smallBold" accessibilityRole="header" style={styles.section}>{query ? 'Suggestions' : 'Suggested searches'}</ThemedText>
        {suggestions.map(({ label, recent }) => <View key={label.toLowerCase()} style={styles.suggestionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={`Search for ${label}`} onPress={() => submitSearch(label)} style={styles.suggestion}>
            <Ionicons name={recent ? 'time-outline' : 'search-outline'} size={22} color={theme.textSecondary} />
            <ThemedText style={styles.suggestionLabel} numberOfLines={2}>{label}</ThemedText>
          </Pressable>
          {recent ? <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${label} from recent searches`} onPress={() => removeSearch(label)} style={styles.remove}>
            <Ionicons name="close" size={20} color={theme.textSecondary} />
          </Pressable> : null}
        </View>)}
      </View> : null}
    </ScrollView>
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, loading: { alignSelf: 'flex-start', paddingTop: 16 },
  list: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 16 }, section: { paddingTop: 16, paddingBottom: 8, gap: 4 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  clearAll: { minHeight: 48, paddingHorizontal: 8, justifyContent: 'center' },
  suggestionRow: { flexDirection: 'row', alignItems: 'center' },
  suggestion: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 10 },
  suggestionLabel: { flex: 1 },
  remove: { width: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
