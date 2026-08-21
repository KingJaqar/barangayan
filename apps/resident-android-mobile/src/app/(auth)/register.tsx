import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  isPointInPolygon,
  registerSchema,
  SEXES,
  type EmploymentStatus,
  type Sex,
} from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Polygon, MultiPolygon } from 'geojson';

import { AuthHeader } from '@/components/auth-header';
import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from '@/components/birthday-calendar-modal';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female' };

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  unemployed: 'Unemployed',
  student: 'Student',
  self_employed: 'Self-Employed',
  retired: 'Retired',
};

/** YYYY-MM-DD → "August 8, 2000" */
function fmtDate(iso: string | null): string {
  if (!iso) return '';
  return isoToLocalDate(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/**
 * Section card wrapper — same shape as Settings > Profile's SectionCard (rounded,
 * bordered, backgroundElement fill) with an icon + title header, used to break the
 * long registration form into scannable groups instead of one flat field list.
 */
function FormSection({
  icon,
  title,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[sectionStyles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <View style={sectionStyles.titleRow}>
        <Ionicons name={icon} size={16} color={theme.primary} />
        <ThemedText style={sectionStyles.title}>{title}</ThemedText>
      </View>
      <View style={sectionStyles.body}>{children}</View>
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: { fontSize: 14, fontWeight: '700' },
  body: { gap: Spacing.three },
});

/**
 * Wrapping row of selectable chips for the Sex / Employment Status fields — neither
 * has a `TextField` shape, and unlike SegmentedControl this never implies a default
 * selection: with `active` unset, no chip renders as chosen.
 */
function ChoiceChips<T extends string>({
  options,
  labels,
  active,
  onChange,
}: {
  options: readonly T[];
  labels: Record<T, string>;
  active: T | null;
  onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chipRow}>
      {options.map((option) => {
        const isActive = active === option;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            style={[
              styles.chip,
              {
                backgroundColor: isActive ? theme.primary : theme.background,
                borderColor: isActive ? theme.primary : theme.backgroundSelected,
              },
            ]}>
            <ThemedText
              type="small"
              themeColor={isActive ? undefined : 'textSecondary'}
              style={isActive ? { color: theme.onPrimary, fontWeight: '600' } : undefined}>
              {labels[option]}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { setRegistering } = useAuth();

  // Full Name split into structured parts (Register/Profile field-split) — see
  // registerSchema in @barangayan/shared for the required/optional breakdown.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  // Home Address split into structured parts — "Barangay" isn't one of these; it's
  // already barangay.name below (profiles.barangay_id, auto-assigned, AGENTS.md §0).
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | null>(null);
  const [occupation, setOccupation] = useState('');
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
      firstName,
      lastName,
      middleName: middleName || undefined,
      suffix: suffix || undefined,
      sex: sex ?? undefined,
      mobileNumber: mobileNumber || undefined,
      email,
      houseNo,
      street,
      city,
      employmentStatus: employmentStatus ?? undefined,
      occupation: occupation || undefined,
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
    // full_name/home_address are no longer sent — migration 0081's
    // compose_profiles_display_fields() trigger derives both from the structured
    // fields below.
    let signUpSucceeded = false;
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: result.data.email,
        password: result.data.password,
        options: {
          data: {
            first_name: result.data.firstName,
            last_name: result.data.lastName,
            middle_name: result.data.middleName ?? null,
            suffix: result.data.suffix ?? null,
            sex: result.data.sex,
            mobile_number: result.data.mobileNumber ?? null,
            house_no: result.data.houseNo,
            street: result.data.street,
            city: result.data.city,
            employment_status: result.data.employmentStatus,
            occupation: result.data.occupation ?? null,
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]} edges={['top', 'left', 'right']}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <AuthHeader title="Create Account" onBack={() => router.replace('/(auth)/auth-choice')} />

        <Modal
          transparent
          visible={showSuccessModal}
          animationType="fade"
          statusBarTranslucent
          onRequestClose={dismissSuccessModal}>
          <View style={styles.successModalBackdrop}>
            <View style={[styles.successModalCard, { backgroundColor: theme.backgroundElement }]}>
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
            </View>
          </View>
        </Modal>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.introTitle}>Let&apos;s get you set up</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.introSubtitle}>
            Fill in your details below to register with your local barangay.
          </ThemedText>

          <FormSection icon="person-outline" title="Personal Information">
            <View style={styles.fieldPairRow}>
              <View style={styles.fieldPairItem}>
                <TextField label="First Name" value={firstName} onChangeText={setFirstName} error={fieldErrors.firstName} />
              </View>
              <View style={styles.fieldPairItem}>
                <TextField label="Last Name" value={lastName} onChangeText={setLastName} error={fieldErrors.lastName} />
              </View>
            </View>
            <View style={styles.fieldPairRow}>
              <View style={styles.fieldPairItem}>
                <TextField label="Middle Name (optional)" value={middleName} onChangeText={setMiddleName} />
              </View>
              <View style={styles.fieldPairItem}>
                <TextField label="Suffix (optional)" value={suffix} onChangeText={setSuffix} />
              </View>
            </View>

            <View style={styles.choiceField}>
              <ThemedText type="small">Sex</ThemedText>
              <ChoiceChips options={SEXES} labels={SEX_LABELS} active={sex} onChange={setSex} />
              {fieldErrors.sex ? (
                <ThemedText type="small" themeColor="accentRed">
                  {fieldErrors.sex}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.birthdayField}>
              <ThemedText type="small">Birthday</ThemedText>
              <Pressable
                onPress={() => setShowBirthPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Select birthday"
                style={[
                  styles.birthdayInput,
                  { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
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
          </FormSection>

          <FormSection icon="call-outline" title="Contact & Address">
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

            <View style={styles.fieldPairRow}>
              <View style={[styles.fieldPairItem, { flex: 1 }]}>
                <TextField label="House No." value={houseNo} onChangeText={setHouseNo} error={fieldErrors.houseNo} />
              </View>
              <View style={[styles.fieldPairItem, { flex: 2 }]}>
                <TextField label="Street" value={street} onChangeText={setStreet} error={fieldErrors.street} />
              </View>
            </View>
            <TextField label="City" value={city} onChangeText={setCity} error={fieldErrors.city} />

            <View style={[styles.barangayRow, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">Barangay</ThemedText>
              <ThemedText type="smallBold">{barangay?.name ?? 'Loading…'}</ThemedText>
            </View>
          </FormSection>

          <FormSection icon="briefcase-outline" title="Employment">
            <View style={styles.choiceField}>
              <ThemedText type="small">Employment Status</ThemedText>
              <ChoiceChips
                options={EMPLOYMENT_STATUSES}
                labels={EMPLOYMENT_STATUS_LABELS}
                active={employmentStatus}
                onChange={(next) => {
                  setEmploymentStatus(next);
                  if (!EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(next)) setOccupation('');
                }}
              />
              {fieldErrors.employmentStatus ? (
                <ThemedText type="small" themeColor="accentRed">
                  {fieldErrors.employmentStatus}
                </ThemedText>
              ) : null}
            </View>

            {employmentStatus && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus) ? (
              <TextField label="Occupation (optional)" value={occupation} onChangeText={setOccupation} />
            ) : null}
          </FormSection>

          <FormSection icon="lock-closed-outline" title="Account Security">
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
              <View accessibilityLiveRegion="polite" style={styles.passwordMatchIndicator}>
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
          </FormSection>

          {/* Real point-in-polygon geofencing (Module 3) against the barangay's boundary
              polygon — a soft, preliminary check per the project paper: it never blocks
              registration, it only flags the account for admin review when the device's
              reported location falls outside the boundary (see handleVerifyLocation). */}
          <FormSection icon="location-outline" title="Location Verification">
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
          </FormSection>

          {error ? (
            <ThemedText type="small" themeColor="accentRed" style={styles.formError}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.submitActions}>
            <PrimaryButton label="Create Account" loading={loading} onPress={handleSubmit} />
            <View style={styles.footerRow}>
              <ThemedText themeColor="textSecondary" style={styles.footerText}>
                Already have an account?{' '}
              </ThemedText>
              <ThemedText
                onPress={() => router.push('/(auth)/login')}
                style={[styles.footerText, { color: theme.primary, fontWeight: '700' }]}>
                Log in
              </ThemedText>
            </View>
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  root: { flex: 1 },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  introTitle: { fontSize: 22, fontWeight: '700' },
  introSubtitle: { fontSize: 14, marginTop: -Spacing.two, marginBottom: Spacing.one, lineHeight: 20 },
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
    borderWidth: 1,
    gap: Spacing.half,
  },
  fieldPairRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  fieldPairItem: {
    flex: 1,
  },
  choiceField: {
    gap: Spacing.one,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  formError: { textAlign: 'center' },
  submitActions: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  footerText: { fontSize: 14 },
});
