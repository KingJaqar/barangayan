import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';

/**
 * Factors out the FadeIn/FadeOut/LinearTransition idiom already used by
 * <Collapsible/> so conditionally-rendered blocks (`{cond ? <X/> : null}`) animate in
 * and out instead of popping. Purely presentational — wrap the JSX a condition already
 * renders, never the condition itself.
 */
export function AnimatedAppear({
  children,
  layout = true,
  style,
}: {
  children: ReactNode;
  layout?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      exiting={FadeOut.duration(150)}
      layout={layout ? LinearTransition.duration(200) : undefined}
      style={style}>
      {children}
    </Animated.View>
  );
}
