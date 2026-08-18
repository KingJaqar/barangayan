import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';

import { Spacing } from '@/constants/theme';

const STEPS = [1, 2, 3] as const;

/**
 * Shared step indicator for the 3 onboarding screens — purely presentational, carries
 * no navigation logic of its own (each screen still drives its own router.push). The
 * active dot springs its width open so moving between steps reads as motion rather
 * than an instant swap. Colors are passed in rather than read from theme so the same
 * component works against both Welcome's solid `theme.primary` hero background and the
 * neutral background used by the other two steps.
 */
export function OnboardingProgressDots({
  step,
  activeColor,
  inactiveColor,
}: {
  step: 1 | 2 | 3;
  activeColor: string;
  inactiveColor: string;
}) {
  return (
    <View style={styles.row}>
      {STEPS.map((dotStep) => (
        <Dot key={dotStep} active={dotStep === step} activeColor={activeColor} inactiveColor={inactiveColor} />
      ))}
    </View>
  );
}

function Dot({
  active,
  activeColor,
  inactiveColor,
}: {
  active: boolean;
  activeColor: string;
  inactiveColor: string;
}) {
  const widthStyle = useAnimatedStyle(() => ({
    width: withSpring(active ? 22 : 8, { damping: 16, stiffness: 180 }),
  }));

  return (
    <Animated.View
      style={[
        styles.dot,
        widthStyle,
        { backgroundColor: active ? activeColor : inactiveColor, opacity: active ? 1 : 0.5 },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
});
