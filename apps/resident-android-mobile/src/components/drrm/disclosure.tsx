import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

/** Shared M06 treatment for guideline bodies and the inline Alerts date panel. */
export function DrrmDisclosure({ open, onToggle, label, header, children, headerStyle }: {
  open: boolean;
  onToggle: () => void;
  label: string;
  header: ReactNode;
  children: ReactNode;
  headerStyle?: StyleProp<ViewStyle>;
}) {
  const { resident } = useTheme();
  const reduced = useResidentReducedMotion(true);
  const [height, setHeight] = useState(0);
  const expansion = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.parallel([
      Animated.timing(expansion, { toValue: open ? height : 0, duration: reduced ? 0 : open ? 200 : 160, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: false }),
      Animated.timing(opacity, { toValue: open ? 1 : 0, duration: reduced ? 0 : open ? 200 : 160, easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true }),
      Animated.timing(rotation, { toValue: open ? 1 : 0, duration: reduced ? 0 : open ? 200 : 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [open, height, reduced, expansion, opacity, rotation]);

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ expanded: open }}
      onPress={onToggle} style={({ pressed }) => [styles.header, headerStyle, pressed && { backgroundColor: resident.pressed }]}>
      {header}
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
  </>;
}

const styles = StyleSheet.create({
  header: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 14 },
  body: { position: 'absolute', top: 0, left: 0, right: 0 },
});
