import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  leadingIcon?: ReactNode;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'destructive';
}

/** The green pill button used throughout the design file (Login, Register, Verify, etc.).
 * 'destructive' is the red-outlined variant for cancel/undo-style actions (e.g. cancelling
 * a pending payment) — same shape as 'secondary' but in theme.accentRed. */
export function PrimaryButton({ label, leadingIcon, loading, variant = 'primary', disabled, ...props }: PrimaryButtonProps) {
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

const styles = StyleSheet.create({
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
