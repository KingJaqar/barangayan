import { Ionicons } from '@expo/vector-icons';
import { Link, type Href } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const easing = Easing.bezier(0.23, 1, 0.32, 1);

/** Shared by the catalog and Requests; row feedback never scales list geometry. */
export function ServiceListLink({ href, label, divider, children, style }: {
  href: Href;
  label: string;
  divider: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const pressed = useSharedValue(0);
  useEffect(() => () => cancelAnimation(pressed), [pressed]);
  const feedback = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(pressed.value, [0, 1], [resident.card, resident.pressed]),
  }));
  return <Animated.View style={feedback}>
    <Link href={href} asChild>
      <Pressable accessibilityRole="button" accessibilityLabel={label}
        onPressIn={() => { pressed.value = reducedMotion ? 1 : withTiming(1, { duration: 150, easing }); }}
        onPressOut={() => { pressed.value = reducedMotion ? 0 : withTiming(0, { duration: 150, easing }); }}
        style={StyleSheet.flatten([serviceListStyles.row, style, divider && { borderTopWidth: 1, borderTopColor: resident.border }])}>
        {children}
      </Pressable>
    </Link>
  </Animated.View>;
}

export function ServicesPanel({ children }: { children: ReactNode }) {
  const { resident } = useTheme();
  return <View style={[serviceListStyles.panel, { backgroundColor: resident.card, borderColor: resident.border }]}>{children}</View>;
}

/** Retained while exiting, with hidden controls immediately removed from input/focus. */
export function ServicesNewRequestButton({ visible, bottom, onPress, label = 'New request', accessibilityLabel = 'Start a new document request' }: {
  visible: boolean; bottom: number; onPress: () => void; label?: string; accessibilityLabel?: string;
}) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const visibility = useSharedValue(0);
  const [pressed, setPressed] = useState(false);
  const fill = useSharedValue(resident.accent);
  const scale = useSharedValue(1);
  useEffect(() => {
    visibility.value = reducedMotion ? Number(visible) : withTiming(Number(visible), { duration: 200, easing });
    return () => cancelAnimation(visibility);
  }, [visible, reducedMotion, visibility]);
  const color = pressed ? resident.accentPressed : resident.accent;
  useEffect(() => {
    fill.value = reducedMotion ? color : withTiming(color, { duration: 150, easing });
    scale.value = reducedMotion ? 1 : withTiming(pressed ? 0.98 : 1, { duration: 150, easing });
    return () => { cancelAnimation(fill); cancelAnimation(scale); };
  }, [color, fill, scale, pressed, reducedMotion]);
  const feedback = useAnimatedStyle(() => ({ backgroundColor: fill.value, transform: [{ scale: scale.value }] }));
  const motion = useAnimatedStyle(() => ({
    opacity: visibility.value,
    transform: [{ translateY: reducedMotion ? 0 : (1 - visibility.value) * 8 }, { scale: reducedMotion ? 1 : 0.96 + visibility.value * 0.04 }],
  }));
  return <Animated.View pointerEvents={visible ? 'auto' : 'none'} accessibilityElementsHidden={!visible}
    importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'} style={[styles.fabPosition, { bottom }, motion]}>
    <AnimatedPressable disabled={!visible} onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel}
      onPressIn={() => setPressed(true)} onPressOut={() => setPressed(false)}
      style={[styles.fab, { borderColor: resident.controlBorder, borderWidth: resident.accentNeedsOutline ? 1 : 0 }, feedback]}>
      <Ionicons name="add" size={20} color={pressed ? resident.onAccentPressed : resident.onAccent} accessible={false} />
      <ThemedText type="smallBold" style={[styles.fabLabel, { color: pressed ? resident.onAccentPressed : resident.onAccent }]}>{label}</ThemedText>
    </AnimatedPressable>
  </Animated.View>;
}

export const serviceListStyles = StyleSheet.create({
  list: { paddingHorizontal: 20, gap: 20 },
  heading: { fontSize: 26, lineHeight: 32.5, fontWeight: '800', letterSpacing: -0.65 },
  subtitle: { fontSize: 13.5, lineHeight: 20 },
  panel: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingHorizontal: 16, paddingVertical: 14 },
  icon: { width: 48, height: 48, borderRadius: 12, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  info: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  meta: { fontSize: 12.5, lineHeight: 16, marginTop: 2 },
  chevron: { marginTop: 14 },
});

const styles = StyleSheet.create({
  fabPosition: { position: 'absolute', right: 16 },
  fab: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 100, paddingLeft: 16, paddingRight: 20, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  fabLabel: { fontSize: 14.5, lineHeight: 22, flexShrink: 1 },
});
