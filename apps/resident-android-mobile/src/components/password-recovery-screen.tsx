import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

export function PasswordRecoveryScreen({ step, title, description, children }: {
  step: 1 | 2 | 3;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return <StepFlowScreen step={step} totalSteps={3} flowLabel="Password recovery" title={title} description={description}>{children}</StepFlowScreen>;
}

export function StepFlowScreen({ step, totalSteps, flowLabel, title, description, children, presentation = 'default', compact = false }: {
  step: number;
  totalSteps: number;
  flowLabel: string;
  title: string;
  description: string;
  children: ReactNode;
  presentation?: 'default' | 'resident';
  compact?: boolean;
}) {
  const theme = useTheme();
  const resident = presentation === 'resident';
  const reducedMotion = useResidentReducedMotion(compact);
  const [progress] = useState(() => new Animated.Value(1));
  const previousStep = useRef(step);
  useEffect(() => {
    const changed = previousStep.current !== step;
    previousStep.current = step;
    if (!compact || reducedMotion || !changed) { progress.setValue(1); return; }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [compact, reducedMotion, step, progress]);
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: resident ? theme.resident.card : theme.background }]} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView key={step} contentContainerStyle={[styles.scrollContent, resident && { padding: 20 }, compact && { padding: 16 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View style={[styles.content, compact && {
            gap: 16,
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.65, 1] }),
            transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }],
          }]}>
            <View style={styles.progress} accessibilityLabel={`${flowLabel}, step ${step} of ${totalSteps}`}>
              <ThemedText type="small" themeColor="textSecondary">Step {step} of {totalSteps}</ThemedText>
              <View style={styles.progressTrack} importantForAccessibility="no-hide-descendants">
                {Array.from({ length: totalSteps }, (_, i) => i + 1).map((index) => (
                  <View key={index} style={[styles.progressSegment, { backgroundColor: index <= step ? (resident ? theme.resident.accentText : theme.primary) : (resident ? theme.resident.border : theme.backgroundSelected) }]} />
                ))}
              </View>
            </View>
            <View style={[styles.intro, compact && { gap: 6 }]}>
              <ThemedText accessibilityRole="header" style={[styles.title, compact && { fontSize: 23, lineHeight: 30 }]}>{title}</ThemedText>
              <ThemedText themeColor="textSecondary" style={styles.description}>{description}</ThemedText>
            </View>
            {children}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function RecoveryButton({ label, onPress, loading = false, disabled = false }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
}) {
  const theme = useTheme();
  const unavailable = loading || disabled;
  return (
    <Pressable
      onPress={onPress}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: unavailable, busy: loading }}
      style={({ pressed }) => [styles.button, { backgroundColor: theme.primary, opacity: unavailable ? 0.5 : pressed ? 0.85 : 1 }]}>
      {loading ? <ActivityIndicator color={theme.onPrimary} /> : <ThemedText style={[styles.buttonLabel, { color: theme.onPrimary }]}>{label}</ThemedText>}
    </Pressable>
  );
}

export function RecoveryError({ message, presentation = 'default' }: { message: string | null; presentation?: 'default' | 'resident' }) {
  const theme = useTheme();
  const color = presentation === 'resident' ? theme.resident.danger : theme.accentRed;
  if (!message) return null;
  return (
    <View style={[styles.error, { borderColor: color }, presentation === 'resident' && { backgroundColor: theme.resident.dangerSoft }]} accessibilityLiveRegion="polite">
      <Ionicons name="alert-circle-outline" size={20} color={color} />
      <ThemedText type="small" style={[styles.errorText, { color }]}>{message}</ThemedText>
    </View>
  );
}

/** One autofill/paste-capable input, presented as six cells. Screen readers read
 * the input once; the visual cells never become six separate focus targets. */
export function RecoveryCodeInput({ value, onChangeText, disabled }: {
  value: string;
  onChangeText: (value: string) => void;
  disabled: boolean;
}) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.codeField}>
      <ThemedText type="small">Reset code</ThemedText>
      <View style={styles.codeRow}>
        <TextInput
          ref={input}
          value={value}
          onChangeText={(text) => onChangeText(text.replace(/\D/g, '').slice(0, 6))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={!disabled}
          keyboardType="number-pad"
          autoComplete="sms-otp"
          textContentType="oneTimeCode"
          accessibilityLabel="6-digit reset code"
          autoCorrect={false}
          spellCheck={false}
          underlineColorAndroid="transparent"
          caretHidden
          maxLength={6}
          style={styles.codeInput}
        />
        {/* Paint the cells above the native input instead of relying on a transparent
            text color, which Android can replace with its default while editing.
            Touches still reach the one input; its accessibility/autofill stay intact. */}
        <View
          pointerEvents="none"
          style={[styles.codeCells, { backgroundColor: theme.background }]}
          importantForAccessibility="no-hide-descendants">
          {Array.from({ length: 6 }, (_, index) => (
            <View key={index} style={[styles.codeCell, {
              borderColor: focused && index === Math.min(value.length, 5) ? theme.primary : theme.backgroundSelected,
              backgroundColor: disabled ? theme.backgroundElement : theme.background,
            }]}>
              <ThemedText style={styles.codeDigit}>{value[index] ?? ''}</ThemedText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export const recoveryStyles = StyleSheet.create({
  form: { gap: Spacing.four },
  field: { minHeight: 56, borderRadius: 12, paddingHorizontal: Spacing.three, fontSize: 16 },
  help: { fontSize: 14, lineHeight: 20 },
  footer: { gap: Spacing.three, marginTop: Spacing.two },
  textLink: { alignSelf: 'center', paddingVertical: Spacing.two, paddingHorizontal: Spacing.three },
  textLinkLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', textDecorationLine: 'underline' },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1, padding: Spacing.four, paddingTop: Spacing.five },
  content: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: Spacing.five },
  progress: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.three },
  progressTrack: { flexDirection: 'row', gap: 6 },
  progressSegment: { width: 24, height: 4, borderRadius: 2 },
  intro: { gap: 12 },
  title: { fontSize: 26, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5 },
  description: { fontSize: 16, lineHeight: 24 },
  button: { width: '100%', minHeight: 56, paddingVertical: Spacing.three, paddingHorizontal: Spacing.four, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  buttonLabel: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  error: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two, borderWidth: 1, borderRadius: 12, padding: Spacing.three },
  errorText: { flex: 1 },
  codeField: { gap: Spacing.two },
  codeRow: { position: 'relative', overflow: 'hidden' },
  codeCells: { flexDirection: 'row', gap: Spacing.two, zIndex: 1 },
  codeCell: { flex: 1, minHeight: 58, borderWidth: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  codeDigit: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
  codeInput: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'transparent', fontSize: 24, padding: 0 },
});
