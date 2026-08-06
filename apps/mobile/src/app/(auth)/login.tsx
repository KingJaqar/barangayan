import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        <ThemedText type="title" style={styles.title}>
          Barangayan
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.subtitle}>
          Your Barangay, In Your Pocket
        </ThemedText>

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
            secureTextEntry
            value={password}
            onChangeText={setPassword}
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
  subtitle: {
    textAlign: 'center',
    marginTop: -Spacing.three,
  },
  form: {
    gap: Spacing.three,
  },
  forgotLink: {
    alignSelf: 'flex-end',
  },
});
