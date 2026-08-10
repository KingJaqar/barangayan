import { useMemo, useState, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface SegmentOption<Key extends string> {
  key: Key;
  label: string;
}

export interface SegmentedControlProps<Key extends string> {
  segments: SegmentOption<Key>[];
  activeKey: Key;
  onChange: (key: Key) => void;
  activeColor?: 'primary' | 'accentRed';
  variant?: 'filled' | 'outline';
}

export function SegmentedControl<Key extends string>({
  segments,
  activeKey,
  onChange,
  activeColor = 'primary',
  variant = 'filled',
}: SegmentedControlProps<Key>) {
  const theme = useTheme();
  const accent = activeColor === 'accentRed' ? Colors.light.accentRed : theme.primary;
  const pillColor = variant === 'filled' ? accent : theme.background;

  const translateX = useSharedValue(0);
  const [containerWidth, setContainerWidth] = useState(0);

  const activeIndex = useMemo(
    () => segments.findIndex((s) => s.key === activeKey),
    [segments, activeKey]
  );

  const segmentWidth = useMemo(() => {
    if (containerWidth <= 2 * Spacing.half) return 0;
    return (
      (containerWidth - 2 * Spacing.half - (segments.length - 1) * Spacing.half) /
      segments.length
    );
  }, [containerWidth, segments.length]);

  const activeTextStyle = variant === 'filled' ? { color: theme.onPrimary } : { color: accent };

  useEffect(() => {
    if (segmentWidth > 0) {
      translateX.value = withSpring(activeIndex * (segmentWidth + Spacing.half), {
        damping: 18,
        stiffness: 150,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex, segmentWidth]);

  const pillAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <ThemedView
      type="backgroundElement"
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      {segmentWidth > 0 && (
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
            accessibilityState={{ selected: isActive }}>
            <View style={styles.segment}>
              <ThemedText
                type={variant === 'outline' && isActive ? 'smallBold' : 'small'}
                themeColor={isActive ? undefined : 'textSecondary'}
                style={isActive ? activeTextStyle : undefined}>
                {segment.label}
              </ThemedText>
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
    zIndex: 1,
  },
  segment: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
    borderRadius: Spacing.three,
  },
});
