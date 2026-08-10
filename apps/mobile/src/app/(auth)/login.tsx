import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <Image
          source={require('../../../assets/logo/barangayan-logo-1024.png')}
          style={styles.logo}
          contentFit="contain"
          accessibilityLabel="Barangayan logo"
        />
        <ThemedText type="title" style={styles.title}>
          Barangayan
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Your Barangay, In Your Pocket
        </ThemedText>

        {params.registered === '1' ? (
          <ThemedView type="backgroundElement" style={styles.successBanner}>
            <ThemedText type="smallBold">Account created!</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Sign in to continue. Email verification will be available once our
              mail service is set up.
            </ThemedText>
          </ThemedView>
        ) : null}

        <View style={styles.form}>
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
            <ThemedText type="link">Forgot Password?</ThemedText>
          </Link>

          <PrimaryButton label="Log In" loading={loading} onPress={handleLogin} />
        </View>

        <PrimaryButton
          label="Create an Account"
          variant="secondary"
          onPress={() => router.push('/(auth)/register')}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    justifyContent: 'center',
    gap: Spacing.four,
  },
  title: {
    fontSize: 32,
    textAlign: 'center',
  },
  logo: {
    width: 112,
    height: 112,
    alignSelf: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: -Spacing.three,
  },
  successBanner: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.one,
  },
  form: {
    gap: Spacing.three,
  },
  forgotLink: {
    alignSelf: 'flex-end',
  },
});
