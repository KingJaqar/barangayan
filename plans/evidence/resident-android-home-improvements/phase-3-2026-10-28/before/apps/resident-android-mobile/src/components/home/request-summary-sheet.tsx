import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { homeRequestSummary, homeTimestamp, type HomeRequest } from '@/lib/home-request';

/** Retains loaded content through exit; no request, subscription or business action owns this sheet. */
export function RequestSummarySheet({ request, visible, reducedMotion, onClose, onDismiss, onViewFull }: {
  request: HomeRequest;
  visible: boolean;
  reducedMotion: boolean;
  onClose: () => void;
  onDismiss: () => void;
  onViewFull: () => void;
}) {
  const { resident } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [mounted, setMounted] = useState(visible);
  const [sheetHeight, setSheetHeight] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const scrim = useRef(new Animated.Value(0)).current;
  const shown = useRef(visible);
  const dismissPending = useRef(false);
  const entryFocused = useRef(false);
  const closeTarget = useRef<View>(null);
  const dismiss = useRef(onDismiss);
  dismiss.current = onDismiss;
  const summary = homeRequestSummary(request);

  useEffect(() => {
    if (visible && !mounted) { setMounted(true); return; }
    if (!visible && !shown.current) return;
    if (!sheetHeight) {
      if (!visible) { shown.current = false; dismissPending.current = true; setMounted(false); }
      return;
    }
    if (visible) { shown.current = true; dismissPending.current = false; }
    let active = true;
    const animation = Animated.parallel([
      Animated.timing(progress, { toValue: Number(visible), duration: reducedMotion ? 100 : 280, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
      Animated.timing(scrim, { toValue: Number(visible), duration: reducedMotion ? 100 : 200, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
    ]);
    animation.start(({ finished }) => {
      if (!active || !finished) return;
      if (visible && !entryFocused.current && closeTarget.current) {
        entryFocused.current = true;
        AccessibilityInfo.sendAccessibilityEvent(closeTarget.current, 'focus');
      }
      if (finished && !visible) {
        shown.current = false;
        dismissPending.current = true;
        entryFocused.current = false;
        setMounted(false);
        setSheetHeight(0);
      }
    });
    return () => { active = false; animation.stop(); };
  }, [visible, mounted, sheetHeight, reducedMotion, progress, scrim]);

  useEffect(() => {
    if (!mounted && !visible && dismissPending.current) {
      dismissPending.current = false;
      dismiss.current();
    }
  }, [mounted, visible]);

  return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent
    onRequestClose={onClose}>
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: scrim }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss request summary" onPress={onClose} />
      </Animated.View>
      <Animated.View accessibilityViewIsModal onLayout={event => {
        const measured = event.nativeEvent.layout.height;
        setSheetHeight(previous => previous === measured ? previous : measured);
      }} style={[styles.sheet, {
        backgroundColor: resident.card, maxHeight: height * 0.92, paddingBottom: Math.max(32, insets.bottom + 16),
        opacity: reducedMotion ? progress : 1,
        transform: [{ translateY: reducedMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [sheetHeight || height, 0] }) }],
      }]}>
        <View accessible={false} style={[styles.handle, { backgroundColor: resident.border }]} />
        <Pressable ref={closeTarget} hitSlop={4} accessibilityRole="button" accessibilityLabel="Close request summary" onPress={onClose}
          style={({ pressed }) => [styles.close, { backgroundColor: pressed ? resident.pressed : resident.surface }]}>
          <Ionicons name="close" size={18} color={resident.text} accessible={false} />
        </Pressable>
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.titleGroup}>
            <ThemedText style={[styles.category, { color: resident.muted }]}>Document request</ThemedText>
            <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, { color: resident.text }]}>{request.document_types?.name ?? 'Document request'}</ThemedText>
            <ThemedText style={[styles.reference, { color: resident.muted }]}>Ref #{request.reference_number}</ThemedText>
          </View>
        </View>
        <View style={styles.timeline}>
          {summary.stepIndex <= 0 ? <ThemedText accessibilityLiveRegion="polite" style={[styles.status, { color: summary.cancelled ? resident.danger : resident.accentText }]}>{summary.statusLabel}</ThemedText> : null}
          {summary.steps.map((step, index) => <View key={step.status} style={styles.step}>
            <View style={styles.indicator} accessible={false} importantForAccessibility="no-hide-descendants">
              <View style={[styles.dot, { borderColor: step.reached ? resident.accentText : resident.border, backgroundColor: step.reached && !step.current ? resident.accent : resident.card }]}>
                {step.current ? <View style={[styles.currentDot, { backgroundColor: resident.accentText }]} />
                  : step.reached ? <Ionicons name="checkmark" size={14} color={resident.onAccent} /> : null}
              </View>
              {index < summary.steps.length - 1 ? <View style={[styles.line, { backgroundColor: step.reached && !step.current ? resident.accentText : resident.border }]} /> : null}
            </View>
            <View style={styles.stepBody}>
              <ThemedText accessibilityLabel={step.current ? `${step.label}, current stage` : step.label}
                style={[styles.stepLabel, { color: step.reached ? resident.text : resident.muted, fontWeight: step.current ? '700' : step.reached ? '600' : '500' }]}>{step.label}</ThemedText>
              <ThemedText style={[styles.date, { color: resident.muted }]}>{step.date ? homeTimestamp(step.date) : step.detail}</ThemedText>
            </View>
          </View>)}
        </View>
        </ScrollView>
        <View style={styles.footer}>
          <PrimaryButton presentation="resident" label="View full request" disabled={!visible} onPress={onViewFull} />
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, flexShrink: 1 },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', paddingRight: 48 },
  titleGroup: { flex: 1, minWidth: 0 },
  category: { fontSize: 12.5, lineHeight: 18.75 },
  title: { fontSize: 19, lineHeight: 26.125, fontWeight: '800', marginTop: 2 },
  reference: { fontSize: 13, lineHeight: 19.5, marginTop: 4 },
  close: { position: 'absolute', top: 32, right: 20, zIndex: 1, elevation: 4, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  body: { flexShrink: 1, marginTop: 16 },
  timeline: { gap: 0, marginTop: 24, paddingRight: 48 },
  status: { fontSize: 12.5, lineHeight: 18, fontWeight: '600', marginBottom: 16 },
  step: { flexDirection: 'row', gap: 14 },
  indicator: { width: 24, alignItems: 'center' },
  dot: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  currentDot: { width: 8, height: 8, borderRadius: 4 },
  line: { width: 2, flex: 1, minHeight: 24 },
  stepBody: { flex: 1, paddingBottom: 20, marginTop: -2 },
  stepLabel: { fontSize: 14.5, lineHeight: 21.75 },
  date: { fontSize: 12.5, lineHeight: 18.75 },
  footer: { marginTop: 8 },
});
