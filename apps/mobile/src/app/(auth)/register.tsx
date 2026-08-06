import { registerSchema } from '@barangayan/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';

export default function RegisterScreen() {
  const router = useRouter();
  const { setOnboarding } = useAuth();

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Looked up, never hardcoded (AGENTS.md §0) — auto-selects when there's exactly one
  // barangay (true today); a real picker only matters once a second barangay exists.
  const [barangay, setBarangay] = useState<{ id: string; name: string } | null>(null);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('barangays')
      .select('id, name')
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) setBarangay(data[0]);
      });
  }, []);

  async function handleSubmit() {
    setError(null);
    setFieldErrors({});

    if (!barangay) {
      setError('Barangay not loaded yet — try again in a moment.');
      return;
    }

    const result = registerSchema.safeParse({
      fullName,
      mobileNumber: mobileNumber || undefined,
      email,
      homeAddress: homeAddress || undefined,
      password,
      confirmPassword,
      barangayId: barangay.id,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const { error: signUpError, data } = await supabase.auth.signUp({
      email: result.data.email,
      password: result.data.password,
    });
    setLoading(false);

    if (signUpError || !data.user) {
      setError(signUpError?.message ?? 'Could not create account.');
      return;
    }

    // Held in (auth) despite verifyOtp establishing a session next — see use-auth.tsx.
    setOnboarding(true);
    router.push({
      pathname: '/(auth)/otp',
      params: {
        type: 'signup',
        email: result.data.email,
        fullName: result.data.fullName,
        mobileNumber: result.data.mobileNumber ?? '',
        homeAddress: result.data.homeAddress ?? '',
        barangayId: barangay.id,
      },
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Create Account
        </ThemedText>
        <ThemedText themeColor="textSecondary">
          Please fill in your details to get started.
        </ThemedText>

        <View style={styles.form}>
          <TextField label="Full Name" value={fullName} onChangeText={setFullName} error={fieldErrors.fullName} />
          <TextField
            label="Mobile Number"
            keyboardType="phone-pad"
            value={mobileNumber}
            onChangeText={setMobileNumber}
          />
          <TextField
            label="Email Address"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            error={fieldErrors.email}
          />
          <TextField label="Home Address" value={homeAddress} onChangeText={setHomeAddress} />
          <TextField
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
          />
          <TextField
            label="Confirm Password"
            secureTextEntry
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={fieldErrors.confirmPassword}
          />

          <ThemedView type="backgroundElement" style={styles.barangayRow}>
            <ThemedText type="small">Barangay</ThemedText>
            <ThemedText type="smallBold">{barangay?.name ?? 'Loading…'}</ThemedText>
          </ThemedView>

          {/* Real geofencing (Point-in-Polygon) is Module 3 work, deferred — this is a
              presentational stand-in for the design's Location Verification step. */}
          <ThemedView type="backgroundElement" style={styles.locationBox}>
            <ThemedText type="small">Location Verification</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This preliminary check ensures you reside within the serviced municipality.
            </ThemedText>
            <PrimaryButton
              label={locationAllowed ? 'Location Access Allowed ✓' : 'Allow Location Access'}
              variant="secondary"
              onPress={() => setLocationAllowed(true)}
            />
          </ThemedView>

          {error ? (
            <ThemedText type="small" themeColor="accentRed">
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton label="Continue →" loading={loading} onPress={handleSubmit} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
  },
  form: {
    gap: Spacing.three,
    marginTop: Spacing.three,
  },
  barangayRow: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  locationBox: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
});
