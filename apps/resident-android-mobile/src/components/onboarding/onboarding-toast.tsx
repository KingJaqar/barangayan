import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Inline confirmation leaves the appearance and color controls available. */
export function OnboardingToast({ visible, message, onHide }: {
  visible: boolean; message: string; onHide: () => void;
}) {
  const theme = useTheme();
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onHide, 2200);
    return () => clearTimeout(timer);
  }, [visible, message, onHide]);

  if (!visible) return null;
  return (
    <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(180)} style={styles.row} accessibilityLiveRegion="polite">
      <Ionicons name="checkmark-circle-outline" size={18} color={theme.text} accessible={false} />
      <ThemedText type="small" style={styles.text}>{message}</ThemedText>
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  text: { flex: 1, fontWeight: '400' },
});
