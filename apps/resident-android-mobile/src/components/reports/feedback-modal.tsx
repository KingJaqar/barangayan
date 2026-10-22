import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useReportModalMotion } from '@/hooks/use-report-modal-motion';
import { useTheme } from '@/hooks/use-theme';

export type FeedbackKind = 'success' | 'error';
export function FeedbackModal({ visible, kind, title, message, onDismiss, autoDismissMs = 2200 }: {
  visible: boolean; kind: FeedbackKind; title: string; message?: string; onDismiss: () => void; autoDismissMs?: number;
}) {
  const { resident } = useTheme();
  const { mounted, panel, reduced } = useReportModalMotion(visible, 200);
  const dismiss = useRef(onDismiss);
  const acknowledged = useRef(false);
  const [content, setContent] = useState({ kind, title, message });
  useEffect(() => { dismiss.current = onDismiss; }, [onDismiss]);
  useEffect(() => { if (visible) setContent({ kind, title, message }); }, [visible, kind, title, message]);
  useEffect(() => {
    if (!visible) return;
    acknowledged.current = false;
    const timer = setTimeout(() => { if (!acknowledged.current) { acknowledged.current = true; dismiss.current(); } }, autoDismissMs);
    return () => clearTimeout(timer);
  }, [visible, autoDismissMs]);
  const color = content.kind === 'success' ? resident.accentText : resident.danger;
  function close() { if (visible && !acknowledged.current) { acknowledged.current = true; dismiss.current(); } }
  return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={close}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: panel }]} />
    <ScrollView contentContainerStyle={styles.overlay}>
      <Animated.View accessibilityViewIsModal style={[styles.card, { backgroundColor: resident.card, opacity: panel,
        transform: [{ scale: reduced ? 1 : panel.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
        <View style={[styles.icon, { backgroundColor: content.kind === 'success' ? resident.accentSoft : resident.dangerSoft }]}>
          <Ionicons name={content.kind === 'success' ? 'checkmark-circle-outline' : 'alert-circle-outline'} size={40} color={color} />
        </View>
        <ThemedText accessibilityRole="header" style={[styles.title, { color: resident.text }]}>{content.title}</ThemedText>
        {content.message ? <ThemedText style={[styles.message, { color: resident.muted }]}>{content.message}</ThemedText> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="Close feedback" onPress={close} style={styles.close}>
          <ThemedText style={{ color: resident.accentText, fontWeight: '700' }}>Close</ThemedText>
        </Pressable>
      </Animated.View>
    </ScrollView>
  </Modal>;
}
const styles = StyleSheet.create({
  overlay: { flexGrow: 1, padding: 32, justifyContent: 'center', alignItems: 'center' },
  card: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 24, gap: 12, alignItems: 'center' },
  icon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  message: { fontSize: 14.5, lineHeight: 20, textAlign: 'center' },
  close: { minHeight: 44, paddingHorizontal: 16, justifyContent: 'center' },
});
