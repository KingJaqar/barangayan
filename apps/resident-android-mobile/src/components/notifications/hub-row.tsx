import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ReadAction, reportStyles, reportTimeAgo } from '@/components/reports/report-presentation';
import { ThemedText } from '@/components/themed-text';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** One announcement or notification row: the link opens it, the sibling control toggles only its read marker. */
export function HubRow({ icon, tone, label, stamp, title, body, unread, accessibilityLabel, onPress, read }: {
  icon: keyof typeof Ionicons.glyphMap; tone: { ink: string; soft: string }; label: string; stamp: string;
  title: string; body: string; unread: boolean; accessibilityLabel: string; onPress: () => void;
  /** Absent for guests, who have no read state. */
  read: { label: string; action: () => Promise<void> } | null;
}) {
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
  return <View style={[reportStyles.row, { backgroundColor: resident.card }]}>
    <AnimatedPressable onPress={onPress} onPressIn={() => animatePress(0.84)} onPressOut={() => animatePress(1)}
      accessibilityRole="button" accessibilityLabel={accessibilityLabel} style={[reportStyles.rowLink, styles.link, feedback]}>
      <View style={[styles.icon, { backgroundColor: tone.soft }]}><Ionicons name={icon} size={20} color={tone.ink} accessible={false} /></View>
      <View style={reportStyles.content}>
        <View style={styles.metadata}>
          <ThemedText style={[styles.category, { color: tone.ink }]}>{label}</ThemedText>
          <ThemedText style={[reportStyles.stamp, { color: resident.muted }]}>{reportTimeAgo(stamp)}</ThemedText>
        </View>
        <View style={reportStyles.titleRow}>
          {unread ? <View style={[reportStyles.unread, { backgroundColor: resident.accentText }]} /> : null}
          <ThemedText style={[reportStyles.title, { color: resident.text, fontWeight: unread ? '800' : '600' }]}>{title}</ThemedText>
        </View>
        <ThemedText numberOfLines={2} style={[reportStyles.summary, styles.summary, { color: resident.muted }]}>{body}</ThemedText>
        <ThemedText style={[reportStyles.stamp, { color: resident.muted }]}>{new Date(stamp).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })}</ThemedText>
      </View>
    </AnimatedPressable>
    {read ? <ReadAction compact label={read.label} icon={unread ? 'mail-outline' : 'mail-open-outline'} action={read.action} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  link: { paddingLeft: 12, paddingRight: 4, paddingVertical: 12, gap: 10 },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8, rowGap: 0 },
  summary: { fontSize: 13, lineHeight: 18 },
  icon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  category: { fontSize: 12.5, lineHeight: 18, fontWeight: '700' },
});
