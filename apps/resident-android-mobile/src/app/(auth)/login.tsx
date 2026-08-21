import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHeader } from '@/components/auth-header';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type LoginParams = {
  /** Set by register.tsx after a successful sign-up — shows a one-time success banner. */
  registered?: string;
  /** Prefills the email field when coming from the registration flow. */
  email?: string;
};

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<LoginParams>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }
    // No explicit navigation needed — the session update flows into AuthProvider and
    // Stack.Protected in the root layout routes into (app) automatically.
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]} edges={['top', 'left', 'right']}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <AuthHeader title="Log In" onBack={() => router.replace('/(auth)/auth-choice')} />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <ThemedText style={styles.welcomeTitle}>Welcome back</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.welcomeSubtitle}>
              Log in to continue to your barangay community.
            </ThemedText>

            {params.registered === '1' ? (
              <View style={[styles.successBanner, { backgroundColor: `${theme.primary}1A`, borderColor: `${theme.primary}40` }]}>
                <ThemedText type="smallBold" style={{ color: theme.primary }}>
                  Account created!
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Sign in to continue. Email verification will be available once our mail service is
                  set up.
                </ThemedText>
              </View>
            ) : null}

            <View
              style={[
                styles.formCard,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              ]}>
              <TextField
                label="Email"
                placeholder="you@example.com"
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
              />
              <TextField
                label="Password"
                placeholder="Password"
                secureTextEntry={!isPasswordVisible}
                value={password}
                onChangeText={setPassword}
                passwordVisibility={{
                  visible: isPasswordVisible,
                  onToggle: () => setIsPasswordVisible((visible) => !visible),
                }}
              />

              {error ? (
                <ThemedText type="small" themeColor="accentRed">
                  {error}
                </ThemedText>
              ) : null}

              <Link href="/(auth)/forgot-password" style={styles.forgotLink}>
                <ThemedText type="link" style={{ color: theme.primary, fontWeight: '600' }}>
                  Forgot Password?
                </ThemedText>
              </Link>
            </View>

            <PrimaryButton label="Log In" loading={loading} onPress={handleLogin} />

            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]} />
              <ThemedText type="small" themeColor="textSecondary">
                OR
              </ThemedText>
              <View style={[styles.dividerLine, { backgroundColor: theme.backgroundSelected }]} />
            </View>

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
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },
  kav: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  welcomeTitle: { fontSize: 24, fontWeight: '700' },
  welcomeSubtitle: { fontSize: 14, marginTop: -Spacing.two, lineHeight: 20 },
  successBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.half,
  },
  formCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  forgotLink: {
    alignSelf: 'flex-end',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  dividerLine: { flex: 1, height: 1 },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: 14 },
});
