import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { ResidentLayout } from '@/constants/resident-theme';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useTheme } from '@/hooks/use-theme';

export interface TextFieldProps extends TextInputProps {
  presentation?: 'default' | 'resident';
  appearance?: 'default' | 'requestForm';
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
  presentation = 'default',
  appearance = 'default',
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const theme = useTheme();
  const inputRef = useRef<TextInput>(null);
  const { fontId } = useFontPreference();
  const resident = presentation === 'resident';
  const [focused, setFocused] = useState(false);
  const focusFrame = useRef<number | null>(null);
  useEffect(() => () => {
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
  }, []);

  function handlePasswordVisibilityToggle() {
    passwordVisibility?.onToggle();
    // Tapping the affordance should not interrupt typing or dismiss the keyboard.
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => { focusFrame.current = null; inputRef.current?.focus(); });
  }

  const input = <TextInput
    ref={inputRef}
    placeholderTextColor={resident ? theme.resident.muted : theme.textSecondary}
    accessibilityLabel={resident ? label : undefined}
    style={[
      styles.input,
      passwordVisibility && styles.inputWithPasswordToggle,
      { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
      resident && {
        fontFamily: getMobileFontFamily(fontId),
        color: theme.resident.text,
        backgroundColor: theme.resident.surface,
        borderRadius: ResidentLayout.controlRadius,
        minHeight: ResidentLayout.controlHeight,
        borderColor: error ? theme.resident.danger : focused ? theme.resident.accentText : appearance === 'requestForm' ? theme.resident.border : theme.resident.controlBorder,
      },
      style,
    ]}
    selectionColor={resident ? theme.resident.accentText : undefined}
    secureTextEntry={passwordVisibility ? !passwordVisibility.visible : secureTextEntry}
    onFocus={(event) => { if (resident) setFocused(true); onFocus?.(event); }}
    onBlur={(event) => { if (resident) setFocused(false); onBlur?.(event); }}
    {...inputProps}
  />;
  const toggle = passwordVisibility ? <Pressable
    accessibilityRole="button"
    accessibilityLabel={passwordVisibility.visible ? 'Hide password' : 'Show password'}
    accessibilityHint="Toggles password visibility"
    hitSlop={Spacing.one}
    disabled={resident && inputProps.editable === false}
    onPress={handlePasswordVisibilityToggle}
    style={({ pressed }) => [styles.passwordToggle, resident && { top: 0, bottom: 0, height: 'auto' }, pressed && styles.passwordTogglePressed]}>
    <Ionicons name={passwordVisibility.visible ? 'eye-outline' : 'eye-off-outline'} size={20} color={resident ? theme.resident.muted : theme.textSecondary} />
  </Pressable> : null;

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
      {resident ? <View>{input}{toggle}</View> : <>{input}{toggle}</>}
      {error ? (
        <View style={styles.statusRow}>
          <Ionicons name="alert-circle-outline" size={14} color={resident ? theme.resident.danger : theme.accentRed} />
          <ThemedText type="small" themeColor="accentRed" accessibilityRole={resident ? 'alert' : undefined} style={resident ? { color: theme.resident.danger, flex: 1 } : undefined}>
            {error}
          </ThemedText>
        </View>
      ) : success ? (
        <View style={styles.statusRow}>
          <Ionicons name="checkmark-circle-outline" size={14} color={resident ? theme.resident.success : theme.accentGreen} />
          <ThemedText type="small" themeColor="accentGreen" style={resident ? { color: theme.resident.success, flex: 1 } : undefined}>
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
