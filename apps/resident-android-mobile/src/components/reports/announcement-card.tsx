import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ReadAction, reportStyles, reportTimeAgo, useReportTone } from '@/components/reports/report-presentation';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function AnnouncementCard({ announcement, onPress }: { announcement: Tables<'announcements'>; onPress: () => void }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const opacity = useSharedValue(1);
  const feedback = useAnimatedStyle(() => ({ opacity: reducedMotion ? 1 : opacity.value }));
  useEffect(() => {
    if (reducedMotion) opacity.value = 1;
    return () => cancelAnimation(opacity);
  }, [opacity, reducedMotion]);
  function animatePress(value: number) {
    opacity.value = reducedMotion ? 1 : withTiming(value, { duration: 140, easing: Easing.out(Easing.quad) });
  }
  const { session } = useAuth();
  const { unreadAnnouncementIds, markAnnouncementRead, markAnnouncementUnread } = useUnreadCounts();
  const unread = unreadAnnouncementIds.includes(announcement.id);
  const meta = ANNOUNCEMENT_CATEGORY_META[announcement.category as AnnouncementCategory] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const tone = useReportTone(meta.color);
  return <View style={[reportStyles.row, { backgroundColor: resident.card }]}>
    <AnimatedPressable onPress={onPress} onPressIn={() => animatePress(0.84)} onPressOut={() => animatePress(1)}
      accessibilityRole="button" accessibilityLabel={`View announcement: ${announcement.title}${unread ? ', unread' : ''}`}
      style={[reportStyles.rowLink, styles.link, feedback]}>
      <View style={[styles.icon, { backgroundColor: tone.soft }]}><Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={20} color={tone.ink} accessible={false} /></View>
      <View style={reportStyles.content}>
        <View style={styles.metadata}>
          <ThemedText style={[styles.category, { color: tone.ink }]}>{meta.label}</ThemedText>
          <ThemedText style={[reportStyles.stamp, { color: resident.muted }]}>{reportTimeAgo(announcement.published_at)}</ThemedText>
        </View>
        <View style={reportStyles.titleRow}>
          {unread ? <View style={[reportStyles.unread, { backgroundColor: resident.accentText }]} /> : null}
          <ThemedText style={[reportStyles.title, { color: resident.text, fontWeight: unread ? '800' : '600' }]}>{announcement.title}</ThemedText>
        </View>
        <ThemedText numberOfLines={2} style={[reportStyles.summary, styles.summary, { color: resident.muted }]}>{announcement.body}</ThemedText>
        <ThemedText style={[reportStyles.stamp, { color: resident.muted }]}>{new Date(announcement.published_at).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</ThemedText>
      </View>
    </AnimatedPressable>
    {session ? <ReadAction compact label={`Mark ${announcement.title} as ${unread ? 'read' : 'unread'}`} icon={unread ? 'mail-outline' : 'mail-open-outline'}
      action={() => unread ? markAnnouncementRead(announcement.id) : markAnnouncementUnread(announcement.id)} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  link: { paddingLeft: 12, paddingRight: 4, paddingVertical: 12, gap: 10 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, rowGap: 0 },
  summary: { fontSize: 13, lineHeight: 18 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  category: { fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
});
