import { isPointInPolygon, registerSchema } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { Polygon, MultiPolygon } from 'geojson';

import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from '@/components/birthday-calendar-modal';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/** YYYY-MM-DD → "August 8, 2000" */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return isoToLocalDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { setRegistering } = useAuth();

  const [fullName, setFullName] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [homeAddress, setHomeAddress] = useState('');
  const [birthDateIso, setBirthDateIso] = useState<string | null>(null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  // Looked up, never hardcoded (AGENTS.md §0) — auto-selects when there's exactly one
  // barangay (true today); a real picker only matters once a second barangay exists.
  const [barangay, setBarangay] = useState<{ id: string; name: string; boundary: Polygon | MultiPolygon | null } | null>(null);
  const [locationAllowed, setLocationAllowed] = useState(false);
  const [locationChecking, setLocationChecking] = useState(false);
  // Point-in-polygon result, sent as signup metadata (0075) for admin review — a soft
  // advisory flag only, per the project paper. `verified` stays null (not false) when
  // the check couldn't run at all (no boundary configured / permission denied / GPS
  // unavailable) so an inconclusive check is never mistaken for "outside the boundary."
  const [locationResult, setLocationResult] = useState<{ verified: boolean | null; lat: number; lng: number } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successfulRegistrationEmail, setSuccessfulRegistrationEmail] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const hasEnteredBothPasswords = password.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = hasEnteredBothPasswords && password === confirmPassword;
  // The status row below is the single place that reports a mismatch in real time.
  // Keep any other Confirm Password validation message, but avoid duplicating the
  // schema's mismatch message directly under the field after submission.
  const confirmPasswordError =
    fieldErrors.confirmPassword === "Passwords don't match" ? undefined : fieldErrors.confirmPassword;

  useEffect(() => {
    supabase
      .from('barangays')
      .select('id, name, boundary')
      .limit(1)
      .then(({ data }) => {
        if (data && data[0]) {
          setBarangay(data[0] as unknown as { id: string; name: string; boundary: Polygon | MultiPolygon | null });
        }
      });
  }, []);

  // Real point-in-polygon geofencing (Module 3), replacing the previous stand-in that
  // just flipped local state. Soft check only — never blocks registration (see the
  // locationResult state comment and 0075's column comments for why).
  async function handleVerifyLocation() {
    setLocationChecking(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        // Permission denied — allow registration to proceed unflagged (inconclusive,
        // not "outside"); this mirrors the soft-check guardrail.
        setLocationAllowed(true);
        setLocationResult(null);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      const verified = barangay?.boundary ? isPointInPolygon(point, barangay.boundary) : null;
      setLocationResult({ verified, lat: point.lat, lng: point.lng });
      setLocationAllowed(true);
    } catch {
      setLocationAllowed(true);
      setLocationResult(null);
    } finally {
      setLocationChecking(false);
    }
  }

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
      birthDate: birthDateIso ?? undefined,
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
    // Suppress Stack.Protected's auto-redirect into (app) for the duration of the signup —
    // see the isRegistering doc comment in use-auth.tsx for why this is needed.
    setRegistering(true);

    // Profile fields travel as signup metadata so the handle_new_user() database
    // trigger can create the profiles row atomically with the auth.users row —
    // see migration 0012. Confirm Email must be disabled in the hosted project;
    // signUp() will then return a live session immediately. We sign that session
    // out right after so the resident must go through Login explicitly.
    let signUpSucceeded = false;
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          data: {
            full_name: result.data.fullName,
            mobile_number: result.data.mobileNumber ?? null,
            home_address: result.data.homeAddress ?? null,
            birth_date: result.data.birthDate ?? null,
            barangay_id: barangay.id,
            // Soft geofencing flag (0075) — read by handle_new_user(), never blocks signup.
            location_verified: locationResult?.verified ?? null,
            registration_lat: locationResult?.lat ?? null,
            registration_lng: locationResult?.lng ?? null,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // If no session came back, Confirm Email is still enabled on the hosted project.
      // Surface a clear, actionable message instead of silently routing to Login.
      if (!signUpData.session) {
        setError(
          'Account creation requires email confirmation, but that is not yet supported. ' +
            'Please contact support or try again later.',
        );
        return;
      }

      // The trigger created the profile. Use local scope so only this device's
      // session is cleared — we do not want to revoke tokens across other devices
      // (relevant during testing with multiple clients). Navigation to Login goes
      // in finally so it runs even if the remote revoke stalls or fails.
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' });
      if (signOutError) {
        // Non-fatal: the local session is already cleared by the local scope.
        // The user will still land on Login with no active session in this app.
        console.warn('Local sign-out after registration returned an error:', signOutError.message);
      }
      signUpSucceeded = true;
    } finally {
      setLoading(false);
      // Session is signed back out (or was never established) by this point, so it's
      // safe to let Stack.Protected's normal guard logic resume.
      setRegistering(false);
      // Only show the success modal on the success path. Error paths set an error
      // message and stay on this screen so the resident can correct and retry.
      if (signUpSucceeded) {
        setSuccessfulRegistrationEmail(result.data.email);
        setShowSuccessModal(true);
      }
    }
  }

  function dismissSuccessModal() {
    setShowSuccessModal(false);
  }

  function goToLogin() {
    setShowSuccessModal(false);
    router.replace({
      pathname: '/(auth)/login',
      params: successfulRegistrationEmail ? { email: successfulRegistrationEmail } : undefined,
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Modal
        transparent
        visible={showSuccessModal}
        animationType="fade"
        statusBarTranslucent
        onRequestClose={dismissSuccessModal}>
        <View style={styles.successModalBackdrop}>
          <ThemedView type="backgroundElement" style={styles.successModalCard}>
            <View style={[styles.successIcon, { backgroundColor: `${theme.primary}20` }]}>
              <Ionicons name="checkmark" size={30} color={theme.primary} />
            </View>
            <ThemedText type="title" style={styles.successModalTitle}>
              Account Created Successfully
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.successModalMessage}>
              Your account is ready. Log in to continue to Barangayan.
            </ThemedText>
            <View style={styles.successModalActions}>
              <View style={styles.successModalActionButton}>
                <PrimaryButton label="OK" variant="secondary" onPress={dismissSuccessModal} />
              </View>
              <View style={styles.successModalActionButton}>
                <PrimaryButton label="Proceed to Login" onPress={goToLogin} />
              </View>
            </View>
          </ThemedView>
        </View>
      </Modal>
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

          <View style={styles.birthdayField}>
            <ThemedText type="small">Birthday</ThemedText>
            <Pressable
              onPress={() => setShowBirthPicker(true)}
              accessibilityRole="button"
              accessibilityLabel="Select birthday"
              style={[
                styles.birthdayInput,
                { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected },
              ]}>
              <ThemedText style={birthDateIso ? undefined : { color: theme.textSecondary }}>
                {birthDateIso ? fmtDate(birthDateIso) : 'Select your birthday'}
              </ThemedText>
              <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
            </Pressable>
            {fieldErrors.birthDate ? (
              <ThemedText type="small" themeColor="accentRed">
                {fieldErrors.birthDate}
              </ThemedText>
            ) : null}
          </View>
          <TextField
            label="Password"
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={setPassword}
            error={fieldErrors.password}
            passwordVisibility={{
              visible: isPasswordVisible,
              onToggle: () => setIsPasswordVisible((visible) => !visible),
            }}
          />
          <TextField
            label="Confirm Password"
            secureTextEntry={!isConfirmPasswordVisible}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            error={confirmPasswordError}
            passwordVisibility={{
              visible: isConfirmPasswordVisible,
              onToggle: () => setIsConfirmPasswordVisible((visible) => !visible),
            }}
          />
          {hasEnteredBothPasswords ? (
            <View
              accessibilityLiveRegion="polite"
              style={styles.passwordMatchIndicator}>
              <Ionicons
                name={passwordsMatch ? 'checkmark-circle-outline' : 'alert-circle-outline'}
                size={16}
                color={passwordsMatch ? theme.primary : theme.accentRed}
              />
              <ThemedText
                type="small"
                style={{ color: passwordsMatch ? theme.primary : theme.accentRed }}>
                {passwordsMatch ? 'Passwords match' : "Passwords don't match"}
              </ThemedText>
            </View>
          ) : null}

          <ThemedView type="backgroundElement" style={styles.barangayRow}>
            <ThemedText type="small">Barangay</ThemedText>
            <ThemedText type="smallBold">{barangay?.name ?? 'Loading…'}</ThemedText>
          </ThemedView>

          {/* Real point-in-polygon geofencing (Module 3) against the barangay's boundary
              polygon — a soft, preliminary check per the project paper: it never blocks
              registration, it only flags the account for admin review when the device's
              reported location falls outside the boundary (see handleVerifyLocation). */}
          <ThemedView type="backgroundElement" style={styles.locationBox}>
            <ThemedText type="small">Location Verification</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              This preliminary check ensures you reside within the serviced municipality.
            </ThemedText>
            <PrimaryButton
              label={
                locationChecking
                  ? 'Checking…'
                  : locationAllowed
                    ? 'Location Access Allowed ✓'
                    : 'Allow Location Access'
              }
              variant="secondary"
              disabled={locationChecking}
              onPress={handleVerifyLocation}
            />
            {locationResult?.verified === false ? (
              <ThemedText type="small" themeColor="accentRed">
                Your device's location looks outside the barangay boundary. You can still register — the barangay may review this.
              </ThemedText>
            ) : null}
          </ThemedView>

          {error ? (
            <ThemedText type="small" themeColor="accentRed">
              {error}
            </ThemedText>
          ) : null}

          <PrimaryButton label="Create Account" loading={loading} onPress={handleSubmit} />
          <PrimaryButton
            label="Login"
            variant="secondary"
            onPress={() => router.push('/(auth)/login')}
          />
        </View>
      </ScrollView>

      <BirthdayCalendarModal
        visible={showBirthPicker}
        value={birthDateIso ? isoToLocalDate(birthDateIso) : null}
        onClose={() => setShowBirthPicker(false)}
        onSave={(date) => {
          setBirthDateIso(dateToIso(date));
          setShowBirthPicker(false);
        }}
      />
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
  passwordMatchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  birthdayField: {
    gap: Spacing.one,
  },
  birthdayInput: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  successModalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  successModalCard: {
    padding: Spacing.four,
    borderRadius: Spacing.four,
    alignItems: 'center',
    gap: Spacing.three,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successModalTitle: {
    fontSize: 24,
    textAlign: 'center',
  },
  successModalMessage: {
    textAlign: 'center',
  },
  successModalActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    width: '100%',
  },
  successModalActionButton: {
    flex: 1,
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
