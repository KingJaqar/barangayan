import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Action } from '../../components/ui';
import { layout, space, useColors, useType } from '../../lib/theme';
import { markIntroSeen } from './intro-state';

export const STEP_COUNT = 3;

/** Fades content in once, and not at all when the resident has Reduce Motion on. */
function FadeIn({ children }: { children: ReactNode }) {
  const [opacity] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let animation: Animated.CompositeAnimation | undefined;
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (!active) return;
      if (reduce) { opacity.setValue(1); return; }
      animation = Animated.timing(opacity, { toValue: 1, duration: 240, useNativeDriver: true });
      animation.start();
    });
    return () => { active = false; animation?.stop(); };
  }, [opacity]);
  return <Animated.View style={{ opacity, gap: space[5] }}>{children}</Animated.View>;
}

function StepDots({ step }: { step: number }) {
  const colors = useColors();
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={`Step ${step} of ${STEP_COUNT}`} accessibilityValue={{ min: 1, max: STEP_COUNT, now: step }}
    style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space[2] }}>
    {Array.from({ length: STEP_COUNT }, (_, index) => <View key={index} style={{ height: 6, width: index + 1 === step ? 20 : 6, borderRadius: 3, backgroundColor: index + 1 === step ? colors.primary : colors.border }} />)}
  </View>;
}

/**
 * Leaves the introduction for wherever it was opened from. `depth` is how many introduction
 * screens are stacked above the origin; a direct link has no origin below it, so it falls back to
 * the root decision (which sends residents to Home or account choice).
 */
export function useLeaveIntroduction(depth: number) {
  const router = useRouter();
  return async () => {
    await markIntroSeen();
    if (router.canDismiss()) router.dismiss(depth); else router.replace('/');
  };
}

export function OnboardingFrame({ step, eyebrow, title, description, depth, primaryLabel, onNext, children, centered = false }: {
  step: number; eyebrow: string; title: string; description: string; depth: number; primaryLabel: string; onNext: () => void; children?: ReactNode; centered?: boolean;
}) {
  const colors = useColors();
  const type = useType();
  const insets = useSafeAreaInsets();
  const leave = useLeaveIntroduction(depth);
  return <View style={{ flex: 1, backgroundColor: colors.canvas }}>
    <ScrollView contentContainerStyle={{ flexGrow: 1, padding: layout.margin, paddingTop: space[2], gap: space[6], justifyContent: centered ? 'center' : 'flex-start' }}>
      <View style={{ alignItems: 'flex-end' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip introduction" accessibilityHint="Leaves the introduction. You can open it again from Settings." onPress={() => void leave()}
          style={{ minHeight: layout.controlMin, justifyContent: 'center' }}><Text style={[type.body, { color: colors.primary }]}>Skip</Text></Pressable>
      </View>
      <FadeIn>
        <View style={{ gap: space[2] }}>
          <Text accessibilityElementsHidden importantForAccessibility="no" style={[type.caption, { color: colors.textSecondary, letterSpacing: 1.2 }]}>{eyebrow.toUpperCase()}</Text>
          <Text accessibilityRole="header" style={[type.largeTitle, { color: colors.textPrimary }]}>{title}</Text>
          <Text style={[type.body, { color: colors.textSecondary }]}>{description}</Text>
        </View>
        {children}
      </FadeIn>
    </ScrollView>
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.canvas, paddingHorizontal: layout.margin, paddingTop: space[4], paddingBottom: insets.bottom + space[3], gap: space[4] }}>
      <StepDots step={step} />
      <Action label={primaryLabel} onPress={onNext} />
    </View>
  </View>;
}
