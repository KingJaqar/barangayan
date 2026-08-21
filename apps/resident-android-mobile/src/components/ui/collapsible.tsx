import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Collapsible({
  children,
  title,
  defaultOpen = false,
  bare = false,
}: PropsWithChildren & { title: string; defaultOpen?: boolean;
  /**
   * When true, skips Collapsible's own card surface (white header background +
   * nested backgroundElement content box) and renders just the header/divider
   * and flat children instead. Use this when a parent already provides the
   * card chrome (background, border, radius) — otherwise the two nest into a
   * "box inside a box inside a box" look.
   */
  bare?: boolean;
}) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const rotation = useSharedValue(defaultOpen ? 1 : 0);

  function toggle() {
    setIsOpen((prev) => {
      const next = !prev;
      rotation.value = withTiming(next ? 1 : 0, { duration: 200 });
      return next;
    });
  }

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <ThemedView style={{ backgroundColor: bare ? 'transparent' : theme.background }}>
      <Pressable
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={toggle}>
        <ThemedText type="smallBold" style={{ color: theme.text }}>{title}</ThemedText>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
        </Animated.View>
      </Pressable>

      {isOpen && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(200)}>
          {bare ? (
            <View style={styles.bareContent}>{children}</View>
          ) : (
            <ThemedView type="backgroundElement" style={styles.content}>
              {children}
            </ThemedView>
          )}
        </Animated.View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  pressedHeading: {
    opacity: 0.7,
  },
  content: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
  bareContent: {
    marginTop: Spacing.two,
    gap: Spacing.three,
  },
});
