import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { reportTimeAgo } from '@/components/reports/report-presentation';
import { ThemedText } from '@/components/themed-text';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useTheme } from '@/hooks/use-theme';
import { INBOX_KIND_META, noticeAction } from '@/lib/notification-hub';
import { fetchSystemNotice, type InboxItem, type SystemNotice } from '@/lib/notification-hub-data';

export interface DetailTarget { item: InboxItem; noticeId: string | null; action: { route: string; label: string } | null }
type NoticeResult = { status: 'missing' | 'error' } | { status: 'ready'; notice: SystemNotice };

const NOTICE_TIMEOUT_MS = 12_000;
const stamp = (iso: string) => new Date(iso).toLocaleString('en-PH', { dateStyle: 'long', timeStyle: 'short' });

/** The minimal detail for an Account or System event. A notice is re-read, so a resolved or cancelled one shows no action. */
export function NotificationDetailSheet({ target, visible, readError, onClose, onAction }: {
  target: DetailTarget | null; visible: boolean; readError: boolean; onClose: () => void; onAction: (route: string) => void;
}) {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { mounted, panel, scrim, reduced } = useReportModalMotion(visible);
  const [height, setHeight] = useState(0);
  const [attempt, setAttempt] = useState(0);
  const noticeId = visible ? (target?.noticeId ?? null) : null;
  const key = `${noticeId}:${attempt}`;
  const [settled, setSettled] = useState<{ key: string; result: NoticeResult } | null>(null);
  useEffect(() => {
    if (!noticeId) return;
    const controller = new AbortController();
    let active = true;
    const timeout = setTimeout(() => controller.abort(), NOTICE_TIMEOUT_MS);
    fetchSystemNotice(controller.signal, noticeId).then(
      row => { if (active) setSettled({ key, result: row ? { status: 'ready', notice: row } : { status: 'missing' } }); },
      () => { if (active) setSettled({ key, result: { status: 'error' } }); },
    ).finally(() => clearTimeout(timeout));
    return () => { active = false; controller.abort(); clearTimeout(timeout); };
  }, [noticeId, key]);
  const notice: NoticeResult | { status: 'idle' | 'loading' } = !noticeId ? { status: 'idle' } : settled?.key === key ? settled.result : { status: 'loading' };
  const item = target?.item ?? null;
  const meta = (item ? INBOX_KIND_META[item.kind] : undefined) ?? { label: 'Notification', icon: 'notifications-outline' };
  const current = notice.status === 'ready' ? notice.notice : null;
  const action = target?.noticeId ? (current ? noticeAction(current.state, current.action) : null) : (target?.action ?? null);
  return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close notification" onPress={onClose} />
      </Animated.View>
      <Animated.View accessibilityViewIsModal onLayout={event => { const next = event.nativeEvent.layout.height; setHeight(current => current === next ? current : next); }}
        style={[styles.sheet, { backgroundColor: resident.card, paddingBottom: Math.max(insets.bottom, 16), opacity: reduced ? panel : 1,
          transform: [{ translateY: reduced ? 0 : panel.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }) }] }]}>
        <View style={[styles.handle, { backgroundColor: resident.border }]} />
        <ScrollView key={item?.id} showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <View style={styles.header}>
            <View style={[styles.category, { backgroundColor: resident.accentSoft }]}>
              <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={14} color={resident.accentText} accessible={false} />
              <ThemedText style={{ color: resident.accentText, fontSize: 13, lineHeight: 18, fontWeight: '700' }}>{meta.label}</ThemedText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={[styles.close, { backgroundColor: resident.surface }]}>
              <Ionicons name="close" size={18} color={resident.text} />
            </Pressable>
          </View>
          {item ? <>
            {readError ? <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>Read status could not be saved. Close this notification and use its read control to try again.</ThemedText> : null}
            <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, { color: resident.text }]}>{item.title}</ThemedText>
            <View style={styles.stamp}><Ionicons name="time-outline" size={14} color={resident.muted} accessible={false} />
              <ThemedText style={{ flex: 1, fontSize: 13, lineHeight: 19, color: resident.muted }}>{reportTimeAgo(item.created_at)} · {stamp(item.created_at)}</ThemedText>
            </View>
            <ThemedText style={[styles.detail, { color: resident.text, borderTopColor: resident.border }]}>{item.body}</ThemedText>
            {notice.status === 'loading' ? <ThemedText style={[styles.note, { color: resident.muted }]}>Checking the current status…</ThemedText> : null}
            {notice.status === 'missing' ? <ThemedText style={[styles.note, { color: resident.muted }]}>This notice is no longer available.</ThemedText> : null}
            {notice.status === 'error' ? <View style={styles.note}>
              <ThemedText accessibilityRole="alert" style={{ color: resident.danger }}>The current status could not be loaded.</ThemedText>
              <PrimaryButton presentation="resident" variant="secondary" label="Try again" onPress={() => setAttempt(value => value + 1)} />
            </View> : null}
            {current && current.state !== 'published' ? <ThemedText style={[styles.note, { color: resident.muted }]}>
              {current.state === 'resolved' ? `Resolved ${stamp(current.resolved_at ?? current.updated_at)}` : `Cancelled ${stamp(current.cancelled_at ?? current.updated_at)}`}
            </ThemedText> : null}
            {action ? <View style={styles.action}>
              <PrimaryButton presentation="resident" label={action.label} onPress={() => onAction(action.route)} />
            </View> : null}
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
  close: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4, marginTop: 12 },
  stamp: { flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' },
  detail: { fontSize: 15, lineHeight: 23, borderTopWidth: 1, marginTop: 16, paddingTop: 16 },
  note: { fontSize: 13, lineHeight: 19, marginTop: 12, gap: 8 },
  action: { marginTop: 16 },
});
