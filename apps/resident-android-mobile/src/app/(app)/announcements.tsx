import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FilterChips } from '@/components/filter-chips';
import { AnnouncementsFeed, type FilterKey, useAnnouncementChips } from '@/components/reports/announcements-feed';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

export default function AnnouncementsScreen() {
  const theme = useTheme();
  const { session } = useAuth();
  const { announcementId } = useLocalSearchParams<{ announcementId?: string }>();
  const [filter, setFilter] = useState<FilterKey>('all');
  const chips = useAnnouncementChips();
  const { markAnnouncementsRead } = useUnreadCounts();
  return <View style={[styles.root, { backgroundColor: theme.background }]}>
    <View style={styles.heading}>
      <ThemedText type="heading" style={{ color: theme.primary }}>What&apos;s New</ThemedText>
      {session ? <Pressable accessibilityRole="button" onPress={markAnnouncementsRead} style={styles.action}><ThemedText type="smallBold" style={{ color: theme.primary }}>Mark all as read</ThemedText></Pressable> : null}
    </View>
    <View><FilterChips chips={chips} active={announcementId ? 'all' : filter} onSelect={setFilter} /></View>
    <AnnouncementsFeed activeFilter={announcementId ? 'all' : filter} onFilterChange={setFilter} openId={announcementId} onOpenHandled={() => router.setParams({ announcementId: undefined })} />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  action: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
});
