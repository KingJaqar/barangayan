import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  const height = useSharedValue(0);
  const opacity = useSharedValue(0);
  const measuredHeight = useSharedValue(0);

  function open() {
    setIsMounted(true);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    height.value = withTiming(0, { duration: 220 });
    opacity.value = withTiming(0, { duration: 180 }, (finished) => {
      if (finished) runOnJS(setIsMounted)(false);
    });
  }

  function toggle() {
    if (isOpen) {
      close();
    } else {
      open();
    }
  }

  function onContentLayout(contentHeight: number) {
    if (measuredHeight.value === contentHeight) return;
    measuredHeight.value = contentHeight;
    if (isOpen) {
      height.value = withSpring(contentHeight, { damping: 18, stiffness: 120 });
      opacity.value = withTiming(1, { duration: 200 });
    }
  }

  // Trigger animations once mounted and isOpen becomes true
  const animatedStyle = useAnimatedStyle(() => ({
    height: height.value,
    opacity: opacity.value,
    overflow: 'hidden',
  }));

  return (
    <ThemedView>
      <Pressable
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={toggle}>
        <ThemedText type="small">{title}</ThemedText>
      </Pressable>

      <Animated.View style={animatedStyle}>
        {isMounted && (
          <Animated.View
            onLayout={(e) => onContentLayout(e.nativeEvent.layout.height)}
            style={styles.measureWrapper}>
            <ThemedView type="backgroundElement" style={styles.content}>
              {children}
            </ThemedView>
          </Animated.View>
        )}
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pressedHeading: {
    opacity: 0.7,
  },
  measureWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  content: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
});
