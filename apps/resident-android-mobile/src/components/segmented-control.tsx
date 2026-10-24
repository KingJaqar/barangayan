import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, useEffect, useRef, type ComponentProps } from 'react';
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
  variant?: 'filled' | 'outline' | 'underline';
  presentation?: 'default' | 'resident';
  appearance?: 'default' | 'purpose';
  sizing?: 'equal' | 'content';
  compact?: boolean;
  /** Underline only: reports where the active tab sits, so a scrolling parent can keep it in view. */
  onActiveLayout?: (layout: { x: number; width: number }) => void;
}

export function SegmentedControl<Key extends string>(props: SegmentedControlProps<Key>) {
  return props.variant === 'underline' ? <UnderlineSegments {...props} /> : <PillSegments {...props} />;
}

function UnderlineSegments<Key extends string>({ segments, activeKey, onChange, sizing = 'equal', compact = false, onActiveLayout }: SegmentedControlProps<Key>) {
  const theme = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const active = layouts[activeKey];
  const valid = segments.some(segment => segment.key === activeKey);
  const initialized = useRef(false);
  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const targetX = active?.x;
  const targetWidth = active?.width;
  useEffect(() => {
    if (!valid || targetX === undefined || targetWidth === undefined) return;
    const immediate = reducedMotion || !initialized.current;
    initialized.current = true;
    const timing = { duration: 200, easing: Easing.bezier(0.23, 1, 0.32, 1) };
    x.value = immediate ? targetX : withTiming(targetX, timing);
    width.value = immediate ? targetWidth : withTiming(targetWidth, timing);
    return () => { cancelAnimation(x); cancelAnimation(width); };
  }, [valid, targetX, targetWidth, reducedMotion, x, width]);
  useEffect(() => {
    if (valid && targetX !== undefined && targetWidth !== undefined) onActiveLayout?.({ x: targetX, width: targetWidth });
  }, [valid, targetX, targetWidth, onActiveLayout]);
  const indicator = useAnimatedStyle(() => ({ width: width.value, transform: [{ translateX: x.value }] }));
  return <View accessibilityRole="tablist" style={[styles.underlineContainer, { borderBottomColor: theme.resident.border }]}>
    {segments.map(segment => {
      const selected = segment.key === activeKey;
      return <Pressable key={segment.key} accessibilityRole="tab" accessibilityLabel={segment.label}
        accessibilityState={{ selected }} onPress={() => onChange(segment.key)}
        onLayout={event => {
          const { x: nextX, width: nextWidth } = event.nativeEvent.layout;
          setLayouts(current => current[segment.key]?.x === nextX && current[segment.key]?.width === nextWidth
            ? current : { ...current, [segment.key]: { x: nextX, width: nextWidth } });
        }}
        style={[styles.underlineTab, compact && styles.compactUnderlineTab, sizing === 'equal' ? styles.equalTab : styles.contentTab]}>
        <ThemedText type="smallBold" style={[styles.underlineLabel, { color: selected ? theme.resident.text : theme.resident.muted }]}>{segment.label}</ThemedText>
      </Pressable>;
    })}
    {valid && active ? <Animated.View style={[styles.underline, { pointerEvents: 'none', backgroundColor: theme.resident.accentText }, indicator]} /> : null}
  </View>;
}

function PillSegments<Key extends string>({
  segments,
  activeKey,
  onChange,
  activeColor = 'primary',
  variant = 'filled',
  presentation = 'default',
  appearance = 'default',
  compact = false,
}: SegmentedControlProps<Key>) {
  const theme = useTheme();
  const resident = presentation === 'resident';
  const purpose = resident && appearance === 'purpose';
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

  const activeTextStyle = resident ? { color: purpose ? theme.resident.text : variant === 'filled' ? residentOnAccent : residentAccentText } : variant === 'filled' ? { color: theme.onPrimary } : { color: accent };

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
      style={[styles.container, resident && { backgroundColor: purpose ? theme.resident.accentSoft : theme.resident.surface }, compact && styles.compactContainer, purpose && styles.purposeContainer]}
      onLayout={(e) => { const next = e.nativeEvent.layout.width; setContainerWidth((current) => current === next ? current : next); }}>
      {segmentWidth > 0 && (!resident || activeIndex >= 0) && (
        <Animated.View
          style={[
            styles.pill,
            compact && styles.compactPill,
            purpose && styles.purposePill,
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
            <View style={[styles.segment, compact && styles.compactSegment]}>
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
                  style={[styles.label, compact && styles.compactLabel, resident && { color: theme.resident.muted }, purpose && { color: theme.resident.accentText, fontWeight: '700' }, isActive ? activeTextStyle : undefined]}>
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
  purposeContainer: { borderRadius: 12 },
  purposePill: { borderRadius: 12 },
  compactContainer: { borderRadius: 12, paddingVertical: 0 },
  compactPill: { borderRadius: 10 },
  compactSegment: { paddingVertical: 4 },
  compactLabel: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  underlineContainer: { flexDirection: 'row', position: 'relative', borderBottomWidth: 1 },
  underlineTab: { minWidth: 0, minHeight: 48, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  compactUnderlineTab: { minHeight: 44, paddingVertical: 8 },
  equalTab: { flex: 1 },
  contentTab: { minWidth: 48, paddingHorizontal: 8 },
  underlineLabel: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  underline: { position: 'absolute', left: 0, bottom: -1, height: 3, borderTopLeftRadius: 2, borderTopRightRadius: 2 },
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
