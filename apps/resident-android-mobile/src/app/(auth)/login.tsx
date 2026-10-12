import { GoogleButton } from '@/components/google-button';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHeader } from '@/components/auth-header';
import { GuestBrowseButton } from '@/components/guest-browse-button';
import { LogoutToast } from '@/components/logout-toast';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/use-auth';
import { authSetupRequests, SetupTimeout, SetupOwner } from '@/lib/setup-request';
import { residentEmailStepSchema } from '@barangayan/shared';
import { loginErrorMessage } from '@/lib/login-error';

type LoginParams = {
  /** Prefills the email field when coming from the registration flow. */
  email?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<LoginParams>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const compact = height - insets.top - insets.bottom < 640;
  const { setSetupIntent } = useAuth();
  const owner = useRef(new SetupOwner());
  useEffect(() => { const scope = owner.current; return () => scope.invalidate(); }, []);

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (loading) return;
    const parsedEmail = residentEmailStepSchema.safeParse({ email });
    if (!parsedEmail.success) { setError('Enter a valid email address.'); return; }
    if (!password) { setError('Enter your password.'); return; }
    const owns = owner.current.ticket();
    setError(null);
    setLoading(true);
    try {
      await setSetupIntent('sign_in');
      await authSetupRequests.run(async () => {
        if (!owns()) return;
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: parsedEmail.data.email, password });
        if (signInError) throw signInError;
      });
      if (owns()) setPassword('');
    } catch (cause) { if (owns()) setError(cause instanceof SetupTimeout ? cause.message : loginErrorMessage(cause)); }
    finally { if (owns()) setLoading(false); }
    // No explicit navigation needed — the session update flows into AuthProvider and
    // Stack.Protected in the root layout routes into (app) automatically.
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]} edges={['left', 'right']}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <AuthHeader title="Log In" onBack={() => { if (authSetupRequests.busy) { setError('Please wait for the earlier sign-in request to finish.'); return; } owner.current.invalidate(); setPassword(''); router.replace('/(auth)/auth-choice'); }} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}>
          <ScrollView
            contentContainerStyle={[styles.content, { gap: compact ? 6 : 12, paddingTop: compact ? 8 : 16, paddingBottom: insets.bottom + Spacing.one }]}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            alwaysBounceVertical={false}
            overScrollMode="never"
            showsVerticalScrollIndicator={false}>
            <View style={styles.intro}>
            <ThemedText style={styles.welcomeTitle}>Welcome back</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.welcomeSubtitle}>
              Connect with your barangay.
            </ThemedText>
            </View>
            <View
              style={[
                styles.formCard,
                compact && styles.compactFormCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              ]}>
              <TextField
                label="Email"
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                keyboardType="email-address"
                value={email}
                onChangeText={value => { setEmail(value); setError(null); }}
                style={styles.input}
              />
              <TextField
                label="Password"
                placeholder="Password"
                secureTextEntry={!isPasswordVisible}
                value={password}
                onChangeText={value => { setPassword(value); setError(null); }}
                style={styles.input}
                passwordVisibility={{
                  visible: isPasswordVisible,
                  onToggle: () => setIsPasswordVisible((visible) => !visible),
                }}
              />

              {error ? (
                <ThemedText type="small" themeColor="accentRed" accessibilityLiveRegion="polite">
                  {error}
                </ThemedText>
              ) : null}

              <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
                <ThemedText type="link" style={{ color: theme.primary, fontWeight: '600', lineHeight: 22 }}>
                  Forgot Password?
                </ThemedText>
              </Link>
            </View>

            <PrimaryButton label="Log In" loading={loading} onPress={handleLogin} />

            <GoogleButton label="Sign in with Google" disabled={loading} />

            <View style={styles.footerRow}>
              <ThemedText themeColor="textSecondary" style={styles.footerText}>
                Don&apos;t have an account?{' '}
              </ThemedText>
              <ThemedText
                onPress={() => router.push('/(auth)/register')}
                style={[styles.footerText, { color: theme.primary, fontWeight: '700' }]}>
                Create one
              </ThemedText>
            </View>
            <GuestBrowseButton disabled={loading} />
          </ScrollView>
        </KeyboardAvoidingView>
        <LogoutToast />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },
  kav: { flex: 1 },
  content: {
    paddingHorizontal: Spacing.four,
  },
  intro: { gap: 4 },
  welcomeTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  welcomeSubtitle: { fontSize: 14, lineHeight: 20 },
  input: { minHeight: 44 },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 12,
    gap: 10,
  },
  compactFormCard: { padding: 10, gap: 8 },
  forgotLink: {
    alignSelf: 'flex-end',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: 14 },
});
