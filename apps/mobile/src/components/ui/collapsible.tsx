import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function Collapsible({ children, title, defaultOpen = false }: PropsWithChildren & { title: string; defaultOpen?: boolean }) {
  const theme = useTheme();
  const [isOpen, setIsOpen] = useState(defaultOpen);

  function toggle() {
    setIsOpen((prev) => !prev);
  }

  return (
    <ThemedView style={{ backgroundColor: theme.background }}>
      <Pressable
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={toggle}>
        <ThemedText type="smallBold" style={{ color: theme.text }}>{title}</ThemedText>
      </Pressable>

      {isOpen && (
        <Animated.View entering={FadeIn.duration(150)} exiting={FadeOut.duration(150)} layout={LinearTransition.duration(200)}>
          <ThemedView type="backgroundElement" style={styles.content}>
            {children}
          </ThemedView>
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
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  pressedHeading: {
    opacity: 0.7,
  },
  content: {
    marginTop: Spacing.three,
    borderRadius: Spacing.three,
    padding: Spacing.four,
  },
});
