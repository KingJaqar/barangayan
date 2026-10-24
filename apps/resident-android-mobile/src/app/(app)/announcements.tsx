import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { FilterChips } from '@/components/filter-chips';
import { AnnouncementsFeed, type FilterKey, useAnnouncementChips } from '@/components/reports/announcements-feed';
import { ReadAction, ReportSourceState } from '@/components/reports/report-presentation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

export default function AnnouncementsScreen() {
  const { resident } = useTheme();
  const { session } = useAuth();
  const { announcementId } = useLocalSearchParams<{ announcementId?: string }>();
  const [filter, setFilter] = useState<FilterKey>('all');
  const chips = useAnnouncementChips();
  const { markAnnouncementsRead, announcementsUnreadCount, readStateError, retryReadState } = useUnreadCounts();
  return <View style={[styles.root, { backgroundColor: resident.card }]}>
    <View style={styles.heading}>
      <View style={styles.headingSummary}>
        <ThemedText accessibilityRole="header" style={[styles.title, { color: resident.text }]}>What's New</ThemedText>
        {session ? <ThemedText style={[styles.count, { color: resident.muted }]}>{announcementsUnreadCount > 0 ? `${announcementsUnreadCount} unread` : 'You’re all caught up'}</ThemedText> : null}
      </View>
      {session ? <ReadAction inline label="Mark all as read" action={markAnnouncementsRead} disabled={announcementsUnreadCount === 0} /> : null}
    </View>
    {readStateError ? <ReportSourceState message="Read status could not be refreshed." retry={retryReadState} retryLabel="Retry read status" /> : null}
    <View><FilterChips chips={chips} active={announcementId ? 'all' : filter} onSelect={setFilter} /></View>
    <AnnouncementsFeed activeFilter={announcementId ? 'all' : filter} openId={announcementId} onOpenHandled={() => router.setParams({ announcementId: undefined })} />
  </View>;
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 2, columnGap: 8 },
  headingSummary: { flexGrow: 1, flexShrink: 1, flexBasis: 140 },
  title: { fontSize: 21, lineHeight: 28, fontWeight: '800', paddingVertical: 8, includeFontPadding: false },
  count: { fontSize: 12.5, lineHeight: 18, includeFontPadding: false },
});
