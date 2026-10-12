import { StyleSheet, View } from 'react-native';

const STEPS = [1, 2, 3] as const;

export function OnboardingProgressDots({ step, activeColor, inactiveColor }: {
  step: 1 | 2 | 3; activeColor: string; inactiveColor: string;
}) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`Step ${step} of 3`}>
      {STEPS.map((dotStep) => (
        <View key={dotStep} style={[styles.dot, { width: dotStep === step ? 20 : 6, backgroundColor: dotStep === step ? activeColor : inactiveColor }]} />
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  dot: { height: 6, borderRadius: 3 },
});
