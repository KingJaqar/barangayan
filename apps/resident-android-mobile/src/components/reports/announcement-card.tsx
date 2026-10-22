import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { Pressable, StyleSheet, View } from 'react-native';
import { ReadAction, reportStyles, reportTimeAgo, useReportTone } from '@/components/reports/report-presentation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

export function AnnouncementCard({ announcement, onPress }: { announcement: Tables<'announcements'>; onPress: () => void }) {
  const { resident } = useTheme();
  const { session } = useAuth();
  const { unreadAnnouncementIds, markAnnouncementRead, markAnnouncementUnread } = useUnreadCounts();
  const unread = unreadAnnouncementIds.includes(announcement.id);
  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as AnnouncementCategory] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const tone = useReportTone(meta.color);
  return <View style={[reportStyles.row, { backgroundColor: resident.card }]}>
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View announcement: ${announcement.title}${unread ? ', unread' : ''}`}
      style={({ pressed }) => [reportStyles.rowLink, { paddingVertical: 16 }, pressed && { backgroundColor: resident.pressed }]}>
      <View style={[styles.icon, { backgroundColor: tone.soft }]}><Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={20} color={tone.ink} accessible={false} /></View>
      <View style={reportStyles.content}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 }}>
          <ThemedText style={[styles.category, { color: tone.ink }]}>{meta.label}</ThemedText>
          <ThemedText style={[reportStyles.stamp, { color: resident.muted }]}>{reportTimeAgo(announcement.published_at)}</ThemedText>
        </View>
        <View style={reportStyles.titleRow}>
          {unread ? <View style={[reportStyles.unread, { backgroundColor: resident.accentText }]} /> : null}
          <ThemedText style={[reportStyles.title, { color: resident.text, fontWeight: unread ? '800' : '600' }]}>{announcement.title}</ThemedText>
        </View>
        <ThemedText numberOfLines={2} style={[reportStyles.summary, { fontSize: 13.5, color: resident.muted }]}>{announcement.body}</ThemedText>
        <ThemedText style={[reportStyles.stamp, { color: resident.muted, marginTop: 3 }]}>{new Date(announcement.published_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</ThemedText>
      </View>
    </Pressable>
    {session ? <ReadAction compact label={`Mark ${announcement.title} as ${unread ? 'read' : 'unread'}`} icon={unread ? 'mail-outline' : 'mail-open-outline'}
      action={() => unread ? markAnnouncementRead(announcement.id) : markAnnouncementUnread(announcement.id)} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  category: { fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
});
