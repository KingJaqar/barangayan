import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

/** Measured text stays mounted so reversals and font changes never lose content. */
export function DocumentAccordion({ title, icon, children }: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const [open, setOpen] = useState(false);
  const [height, setHeight] = useState(0);
  const expansion = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(expansion, { toValue: open ? height : 0, duration: reducedMotion ? 0 : 220, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: false }),
      Animated.timing(opacity, { toValue: open ? 1 : 0, duration: reducedMotion ? 0 : 220, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
      Animated.timing(rotation, { toValue: open ? 1 : 0, duration: reducedMotion ? 0 : 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [open, height, reducedMotion, expansion, opacity, rotation]);
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(value => !value)}
      style={({ pressed }) => [styles.heading, { backgroundColor: pressed ? resident.surface : resident.card }]}>
      <Ionicons name={icon} size={18} color={resident.muted} accessible={false} />
      <ThemedText type="smallBold" style={styles.title}>{title}</ThemedText>
      <Animated.View style={{ transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
        <Ionicons name="chevron-down" size={20} color={resident.muted} accessible={false} />
      </Animated.View>
    </Pressable>
    <Animated.View style={{ height: expansion, overflow: 'hidden' }} pointerEvents={open ? 'auto' : 'none'}
      accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
      <Animated.View style={[styles.body, { opacity }]} onLayout={event => {
        const next = event.nativeEvent.layout.height;
        setHeight(previous => previous === next ? previous : next);
      }}>{children}</Animated.View>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  heading: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  title: { flex: 1, fontSize: 14.5, lineHeight: 20 },
  body: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16, gap: 10 },
});
