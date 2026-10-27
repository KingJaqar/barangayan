import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

/** Presentation only: the caller reports success and owns acknowledgement/navigation. */
export function ActionSuccessModal({ visible, title, message, amountLabel, onConfirm }: {
  visible: boolean;
  title: string;
  message: string;
  amountLabel?: string;
  onConfirm: () => void;
}) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const [mounted, setMounted] = useState(visible);
  const [content, setContent] = useState({ title, message, amountLabel });
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) setContent({ title, message, amountLabel });
  }, [visible, title, message, amountLabel]);
  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(progress, { toValue: visible ? 1 : 0, duration: reducedMotion ? 100 : 200, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [visible, reducedMotion, progress]);
  return <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onConfirm}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: resident.scrim, opacity: progress }]} />
    <ScrollView contentContainerStyle={styles.overlay} keyboardShouldPersistTaps="handled">
      <Pressable style={StyleSheet.absoluteFill} accessibilityLabel="Acknowledge confirmation" accessibilityRole="button" onPress={onConfirm} />
      <Animated.View accessibilityViewIsModal style={[styles.card, { backgroundColor: resident.card, opacity: progress, transform: [{ scale: reducedMotion ? 1 : progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>
        <View style={[styles.check, { backgroundColor: resident.accentSoft }]}><Ionicons name="checkmark-circle-outline" size={40} color={resident.accentText} accessible={false} /></View>
        <ThemedText type="residentHeader" accessibilityRole="header" style={[styles.title, { color: resident.text }]}>{content.title}</ThemedText>
        {content.amountLabel ? <ThemedText style={[styles.amount, { color: resident.accentText }]}>{content.amountLabel}</ThemedText> : null}
        <ThemedText style={[styles.caption, { color: resident.muted }]}>{content.message}</ThemedText>
        <PrimaryButton presentation="resident" label="OK" onPress={onConfirm} />
      </Animated.View>
    </ScrollView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: { width: '100%', maxWidth: 340, borderRadius: 24, padding: 24, gap: 12 },
  check: { width: 64, height: 64, borderRadius: 32, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, lineHeight: 25, fontWeight: '800', textAlign: 'center' },
  amount: { fontSize: 24, lineHeight: 30, fontWeight: '800', textAlign: 'center' },
  caption: { fontSize: 14.5, lineHeight: 20, textAlign: 'center', marginBottom: 12 },
});
