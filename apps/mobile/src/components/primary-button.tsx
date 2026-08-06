import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary';
}

/** The green pill button used throughout the design file (Login, Register, Verify, etc.). */
export function PrimaryButton({ label, loading, variant = 'primary', disabled, ...props }: PrimaryButtonProps) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  return (
    <Pressable
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary'
          ? { backgroundColor: theme.primary }
          : { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.backgroundSelected },
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
      ]}
      {...props}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? theme.onPrimary : theme.text} />
      ) : (
        <ThemedText
          type="smallBold"
          themeColor={variant === 'primary' ? undefined : 'text'}
          style={variant === 'primary' ? { color: theme.onPrimary } : undefined}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
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
