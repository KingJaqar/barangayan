import { useEffect, useState, type Ref } from 'react';
import { Pressable, type PressableProps, type View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Home cards/tiles share finite press feedback; routing stays in their existing owner. */
export function HomeAction({ reducedMotion, pressScale = 0.98, pressableRef, style, onPressIn, onPressOut, ...props }: Omit<PressableProps, 'style'> & {
  reducedMotion: boolean;
  pressScale?: number;
  pressableRef?: Ref<View>;
  style?: PressableProps['style'];
}) {
  const scale = useSharedValue(1);
  const [pressed, setPressed] = useState(false);
  useEffect(() => {
    if (reducedMotion) scale.value = 1;
    return () => cancelAnimation(scale);
  }, [reducedMotion, scale]);
  const feedback = useAnimatedStyle(() => ({ transform: [{ scale: reducedMotion ? 1 : scale.value }] }));
  function animate(value: number) {
    scale.value = reducedMotion ? 1 : withTiming(value, { duration: 150, easing: Easing.bezier(0.23, 1, 0.32, 1) });
  }
  return <AnimatedPressable {...props} ref={pressableRef} accessibilityRole="button"
    style={[typeof style === 'function' ? style({ pressed, hovered: false }) : style, feedback]}
    onPressIn={event => { setPressed(true); animate(pressScale); onPressIn?.(event); }}
    onPressOut={event => { setPressed(false); animate(1); onPressOut?.(event); }} />;
}
