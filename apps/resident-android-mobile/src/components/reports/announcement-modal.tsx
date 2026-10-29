import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { reportTimeAgo, useReportTone } from '@/components/reports/report-presentation';
import { ReportPhoto } from '@/components/reports/report-photo';
import { ThemedText } from '@/components/themed-text';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useTheme } from '@/hooks/use-theme';

import { useAdvisoryExpired } from '@/hooks/use-advisory-expired';

export function AnnouncementModal({ visible, announcement, onClose, readError = false }: {
  visible: boolean; announcement: Tables<'announcements'> | null; onClose: () => void; readError?: boolean;
}) {
  const expired = useAdvisoryExpired(announcement, visible);
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, panel, scrim, reduced } = useReportModalMotion(visible);
  const [height, setHeight] = useState(0);
  const meta = ANNOUNCEMENT_CATEGORY_META[(announcement?.category ?? 'general') as AnnouncementCategory] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const tone = useReportTone(meta.color);
  return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close announcement" onPress={onClose} />
      </Animated.View>
      <Animated.View accessibilityViewIsModal onLayout={event => { const next = event.nativeEvent.layout.height; setHeight(current => current === next ? current : next); }}
        style={[styles.sheet, { backgroundColor: resident.card, paddingBottom: Math.max(insets.bottom, 16), opacity: reduced ? panel : 1,
          transform: [{ translateY: reduced ? 0 : panel.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}>
        <View style={[styles.handle, { backgroundColor: resident.border }]} />
        <ScrollView key={announcement?.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View style={styles.header}>
            <View style={[styles.category, { backgroundColor: tone.soft }]}>
              <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={14} color={tone.ink} accessible={false} />
              <ThemedText style={{ color: tone.ink, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{expired ? `${meta.label} · Expired` : meta.label}</ThemedText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[styles.close, { backgroundColor: resident.surface }]}>
              <Ionicons name="close" size={18} color={resident.text} />
            </Pressable>
          </View>
          {announcement ? <>
            {readError ? <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>Read status could not be saved. Close this announcement and use its read control to try again.</ThemedText> : null}
            <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, { color: resident.text }]}>{announcement.title}</ThemedText>
            <View style={styles.stamp}><Ionicons name="time-outline" size={14} color={resident.muted} accessible={false} />
              <ThemedText style={{ flex: 1, fontSize: 13, lineHeight: 19, color: resident.muted }}>{reportTimeAgo(announcement.published_at)} · {new Date(announcement.published_at).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' })}</ThemedText>
            </View>
            {announcement.image_url ? <View style={{ aspectRatio: 4 / 3, borderRadius: 16, overflow: 'hidden', marginTop: 16 }}><ReportPhoto uri={announcement.image_url} /></View> : null}
            <ThemedText style={[styles.detail, { color: resident.text, borderTopColor: resident.border }]}>{announcement.detailed_description?.trim() || announcement.body}</ThemedText>
          </> : null}
        </ScrollView>
      </Animated.View>
    </View>
  </Modal>;
}
const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 12 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  body: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  category: { flexDirection: 'row', alignItems: 'center', flexShrink: 1, gap: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 100 },
  close: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, marginTop: 12 },
  stamp: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
  detail: { fontSize: 15, lineHeight: 23, borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
});
