import { Ionicons } from '@expo/vector-icons';
import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  error?: string;
  /** Shown (green check + message) below the field once its value passes
   * validation — mirrors the Register screen's existing "Passwords match"
   * indicator, generalized to every field. Ignored while `error` is set. */
  success?: string;
  /** Renders a red asterisk after the label — purely visual, does not affect
   * validation (that's still driven by the schema / live field checks). */
  required?: boolean;
  /** Enables an in-field control for revealing or masking password text. */
  passwordVisibility?: {
    visible: boolean;
    onToggle: () => void;
  };
}

export function TextField({
  label,
  error,
  success,
  required,
  style,
  passwordVisibility,
  secureTextEntry,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);

  function handlePasswordVisibilityToggle() {
    passwordVisibility?.onToggle();
    // Tapping the affordance should not interrupt typing or dismiss the keyboard.
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <View style={styles.container}>
      {label ? (
        <View style={styles.labelRow}>
          <ThemedText type="small">{label}</ThemedText>
          {required ? (
            <ThemedText type="small" themeColor="accentRed">
              {' '}
              *
            </ThemedText>
          ) : null}
        </View>
      ) : null}
      <TextInput
        ref={inputRef}
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.input,
          passwordVisibility && styles.inputWithPasswordToggle,
          { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
          style,
        ]}
        secureTextEntry={passwordVisibility ? !passwordVisibility.visible : secureTextEntry}
        {...inputProps}
      />
      {passwordVisibility ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={passwordVisibility.visible ? 'Hide password' : 'Show password'}
          accessibilityHint="Toggles password visibility"
          hitSlop={Spacing.one}
          onPress={handlePasswordVisibilityToggle}
          style={({ pressed }) => [styles.passwordToggle, pressed && styles.passwordTogglePressed]}>
          <Ionicons
            name={passwordVisibility.visible ? 'eye-outline' : 'eye-off-outline'}
            size={20}
            color={theme.textSecondary}
          />
        </Pressable>
      ) : null}
      {error ? (
        <View style={styles.statusRow}>
          <Ionicons name="alert-circle-outline" size={14} color={theme.accentRed} />
          <ThemedText type="small" themeColor="accentRed">
            {error}
          </ThemedText>
        </View>
      ) : success ? (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle-outline" size={14} color={theme.accentGreen} />
          <ThemedText type="small" themeColor="accentGreen">
            {success}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  inputWithPasswordToggle: {
    paddingRight: 52,
  },
  passwordToggle: {
    position: 'absolute',
    right: Spacing.one,
    top: 25,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  passwordTogglePressed: {
    opacity: 0.65,
  },
});
