import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, useEffect, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

export interface SegmentOption<Key extends string> {
  key: Key;
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
}

export interface SegmentedControlProps<Key extends string> {
  segments: SegmentOption<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  activeColor?: 'primary' | 'accentRed';
  variant?: 'filled' | 'outline';
  presentation?: 'default' | 'resident';
}

export function SegmentedControl<Key extends string>({
  segments,
  activeKey,
  onChange,
  activeColor = 'primary',
  variant = 'filled',
  presentation = 'default',
}: SegmentedControlProps<Key>) {
  const theme = useTheme();
  const resident = presentation === 'resident';
  const reducedMotion = useResidentReducedMotion(resident);
  const accent = activeColor === 'accentRed' ? Colors.light.accentRed : theme.primary;
  const residentAccent = resident ? (activeColor === 'accentRed' ? theme.resident.danger : theme.resident.accent) : accent;
  const residentOnAccent = resident ? (activeColor === 'accentRed' ? theme.resident.onDanger : theme.resident.onAccent) : theme.onPrimary;
  const residentAccentText = resident ? (activeColor === 'accentRed' ? theme.resident.danger : theme.resident.accentText) : accent;
  const pillColor = resident ? (variant === 'filled' ? residentAccent : theme.resident.card) : variant === 'filled' ? accent : theme.background;

  const translateX = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = useMemo(
    () => segments.findIndex((s) => s.key === activeKey),
    [segments, activeKey]
  );

  const segmentWidth = useMemo(() => {
    if (containerWidth <= 2 * Spacing.half || segments.length === 0) return 0;
    return (
      (containerWidth - 2 * Spacing.half - (segments.length - 1) * Spacing.half) /
      segments.length
    );
  }, [containerWidth, segments.length]);

  const activeTextStyle = resident ? { color: variant === 'filled' ? residentOnAccent : residentAccentText } : variant === 'filled' ? { color: theme.onPrimary } : { color: accent };

  useEffect(() => {
    if (segmentWidth > 0 && (!resident || activeIndex >= 0)) {
      const target = activeIndex * (segmentWidth + Spacing.half);
      if (resident) {
        translateX.value = reducedMotion ? target : withTiming(target, { duration: 220, easing: Easing.bezier(0.23, 1, 0.32, 1) });
        return () => cancelAnimation(translateX);
      }
      // Critically damped — settles on the target segment with zero overshoot/bounce.
      translateX.value = withSpring(activeIndex * (segmentWidth + Spacing.half), {
        damping: 26,
        stiffness: 220,
        mass: 0.8,
        overshootClamping: true,
      });
    }
  }, [activeIndex, segmentWidth, resident, reducedMotion, translateX]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.container, resident && { backgroundColor: theme.resident.surface }]}
      onLayout={(e) => { const next = e.nativeEvent.layout.width; setContainerWidth((current) => current === next ? current : next); }}>
      {segmentWidth > 0 && (!resident || activeIndex >= 0) && (
        <Animated.View
          style={[
            styles.pill,
            {
              left: Spacing.half,
              width: segmentWidth,
              backgroundColor: pillColor,
            },
            pillAnimatedStyle,
          ]}
        />
      )}
      {segments.map((segment) => {
        const isActive = segment.key === activeKey;

        return (
          <Pressable
            key={segment.key}
            onPress={() => onChange(segment.key)}
            style={styles.segmentPressable}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected: isActive }}>
            <View style={styles.segment}>
              {segment.icon ? (
                <Ionicons
                  name={segment.icon}
                  size={22}
                  color={isActive ? activeTextStyle.color : resident ? theme.resident.muted : theme.textSecondary}
                  accessible={false}
                />
              ) : (
                <ThemedText
                  type={variant === 'outline' && isActive ? 'smallBold' : 'small'}
                  themeColor={isActive ? undefined : 'textSecondary'}
                  numberOfLines={resident ? undefined : 1}
                  adjustsFontSizeToFit={!resident}
                  minimumFontScale={0.65}
                  style={[styles.label, resident && { color: theme.resident.muted }, isActive ? activeTextStyle : undefined]}>
                  {segment.label}
                </ThemedText>
              )}
            </View>
          </Pressable>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderRadius: Spacing.four,
    padding: Spacing.half,
    gap: Spacing.half,
    position: 'relative',
    overflow: 'hidden',
  },
  pill: {
    position: 'absolute',
    top: Spacing.half,
    bottom: Spacing.half,
    borderRadius: Spacing.three,
  },
  segmentPressable: {
    flex: 1,
    minWidth: 0,
    zIndex: 1,
  },
  segment: {
    minHeight: 44,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Spacing.three,
  },
  label: {
    width: '100%',
    textAlign: 'center',
  },
});
