import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ResidentLayout } from '@/constants/resident-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';

interface ButtonContentProps extends Omit<PressableProps, 'style'> {
  label: string;
  leadingIcon?: ReactNode;
  loading?: boolean;
}

type ButtonVariant = 'primary' | 'secondary' | 'destructive';
export type PrimaryButtonProps = ButtonContentProps & (
  | { presentation?: 'default'; variant?: ButtonVariant }
  | { presentation: 'resident'; variant?: ButtonVariant | 'destructiveFilled' | 'secondaryAccent'; compact?: boolean; appearance?: 'default' | 'requestForm' | 'healthForm' | 'healthDrive' }
);

/** The green pill button used throughout the design file (Login, Register, Verify, etc.).
 * 'destructive' is the red-outlined variant for cancel/undo-style actions (e.g. cancelling
 * a pending payment) — same shape as 'secondary' but in theme.accentRed.
 * Resident confirmation dialogs use 'destructiveFilled' for the reference's filled action. */
export function PrimaryButton({ presentation = 'default', ...props }: PrimaryButtonProps) {
  return presentation === 'resident' ? <ResidentButton {...props} /> : <DefaultButton {...props} />;
}

function DefaultButton({ label, leadingIcon, loading, variant = 'primary', disabled, ...props }: Omit<PrimaryButtonProps, 'presentation'>) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        !!leadingIcon && !loading && styles.withIcon,
        variant === 'primary'
          ? { backgroundColor: theme.primary }
          : variant === 'destructive'
            ? { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.accentRed }
            : { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.backgroundSelected },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.onPrimary : variant === 'destructive' ? theme.accentRed : theme.text} />
      ) : (
        <>
          {leadingIcon ? <View accessible={false} importantForAccessibility="no-hide-descendants">{leadingIcon}</View> : null}
          <ThemedText
            type="smallBold"
            themeColor={variant === 'primary' ? undefined : variant === 'destructive' ? undefined : 'text'}
            style={[leadingIcon ? { flexShrink: 1, textAlign: 'center' } : undefined, variant === 'primary' ? { color: theme.onPrimary } : variant === 'destructive' ? { color: theme.accentRed } : undefined]}>
            {label}
          </ThemedText>
        </>
      )}
    </Pressable>
  );
}

function ResidentButton({ label, leadingIcon, loading, variant = 'primary', compact = false, appearance = 'default', disabled, onPressIn, onPressOut, accessibilityState, ...props }: Omit<PrimaryButtonProps, 'presentation'> & { compact?: boolean; appearance?: 'default' | 'requestForm' | 'healthForm' | 'healthDrive' }) {
  const { resident } = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const scale = useSharedValue(1);
  const isDisabled = Boolean(disabled || loading);
  const animationStyle = useAnimatedStyle(() => ({ transform: [{ scale: reducedMotion ? 1 : scale.value }] }));
  useEffect(() => {
    if (isDisabled || reducedMotion) { cancelAnimation(scale); scale.value = 1; }
    return () => cancelAnimation(scale);
  }, [isDisabled, reducedMotion, scale]);
  const filledDanger = variant === 'destructiveFilled';
  const accentOutline = variant === 'secondaryAccent';
  const color = isDisabled ? resident.muted : filledDanger ? resident.onDangerFill : variant === 'primary' ? resident.onAccent : variant === 'destructive' ? resident.danger : accentOutline ? resident.accentText : resident.text;
  return (
    <Animated.View style={animationStyle}>
      <Pressable
        {...props}
        accessibilityRole="button"
        accessibilityLabel={props.accessibilityLabel ?? label}
        accessibilityState={{ ...accessibilityState, disabled: isDisabled, busy: Boolean(loading) }}
        disabled={isDisabled}
        onPressIn={(event) => {
          scale.value = reducedMotion ? 1 : withTiming(appearance === 'healthDrive' ? 0.97 : 0.98, { duration: 150, easing: Easing.bezier(0.23, 1, 0.32, 1) });
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          scale.value = reducedMotion ? 1 : withTiming(1, { duration: 150, easing: Easing.bezier(0.23, 1, 0.32, 1) });
          onPressOut?.(event);
        }}
        style={({ pressed }) => [styles.residentButton, compact && styles.compactButton, appearance === 'requestForm' && (variant === 'secondary' ? styles.formSecondary : styles.formPrimary), {
          backgroundColor: isDisabled ? resident.surface : filledDanger ? (pressed ? resident.dangerFillPressed : resident.dangerFill) : variant === 'primary' ? (pressed ? resident.accentPressed : resident.accent) : pressed ? (variant === 'destructive' ? resident.dangerSoft : accentOutline ? resident.accentSoft : resident.pressed) : resident.card,
          borderColor: variant === 'destructive' ? resident.danger : accentOutline ? resident.accentText : appearance === 'requestForm' ? resident.border : resident.controlBorder,
          borderWidth: isDisabled ? 1 : filledDanger ? (resident.dangerFillNeedsOutline ? 1 : 0) : variant === 'destructive' || accentOutline ? 2 : variant === 'primary' && !resident.accentNeedsOutline ? 0 : 1,
        }, appearance === 'requestForm' && isDisabled && (variant === 'primary' ? { backgroundColor: resident.pressed, borderWidth: 0 } : { backgroundColor: resident.card, borderWidth: 1 }),
        // Reserve the border in both consent states so the pinned Health footer never shrinks.
        appearance === 'healthForm' && { borderWidth: 1, borderColor: isDisabled || resident.accentNeedsOutline ? resident.controlBorder : 'transparent' }]}>
        {({ pressed }) => {
          const foreground = !isDisabled && variant === 'primary' && pressed ? resident.onAccentPressed : color;
          return <>
            {loading ? <ActivityIndicator color={foreground} accessible={false} /> : leadingIcon ? <View accessible={false} importantForAccessibility="no-hide-descendants">{leadingIcon}</View> : null}
            <ThemedText type="smallBold" style={[{ color: foreground, fontSize: 15, lineHeight: 22.5, flexShrink: 1, textAlign: 'center' }, compact && styles.compactLabel, appearance === 'requestForm' && variant === 'secondary' && { fontSize: 14, lineHeight: 21 }]}>{label}</ThemedText>
          </>;
        }}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  formPrimary: { paddingHorizontal: 28 },
  formSecondary: { paddingVertical: 12 },
  compactButton: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  compactLabel: { fontSize: 13, lineHeight: 18 },
  residentButton: { minHeight: ResidentLayout.controlHeight, borderRadius: ResidentLayout.controlRadius, paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  withIcon: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  button: {
    paddingVertical: Spacing.three,
    borderRadius: Spacing.four,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.85,
  },
});
