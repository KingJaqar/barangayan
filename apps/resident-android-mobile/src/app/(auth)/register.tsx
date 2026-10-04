import { safeResidentRedirect } from '@barangayan/shared';
import { GoogleButton } from '@/components/google-button';
import { RegistrationMap } from '@/components/registration-map';
import {
  EMAIL_REGEX,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  profileCompletionSchema,
  serviceFoundationOperations,
  registrationLocality,
  residentNamePrefill,
  MOBILE_NUMBER_REGEX,
  NAME_REGEX,
  PASSWORD_COMPLEXITY_REGEX,
  registerSchema,
  SEXES,
  type EmploymentStatus,
  type Sex,
} from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, type Href } from 'expo-router';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AuthHeader } from '@/components/auth-header';
import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from '@/components/birthday-calendar-modal';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
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

/** Red asterisk suffix for required-field labels that don't render through TextField
 * (Sex / Date of Birth / Employment Status use their own chip/pressable labels). */
function RequiredMark() {
  return (
    <ThemedText type="small" themeColor="accentRed">
      {' '}
      *
    </ThemedText>
  );
}

// ─── Live per-field validation ────────────────────────────────────────────────
// Runs the same rules as registerSchema (packages/shared), as-you-type, so a
// field shows a red alert or a green check the moment its value becomes
// invalid/valid — the same treatment the Confirm Password field already gave
// the password-match check, generalized to every text field. Empty fields stay
// silent until a submit attempt populates fieldErrors (the "required" message).
function validateName(value: string): string | null {
  return NAME_REGEX.test(value) ? null : 'Letters only — no numbers or symbols';
}
function validateMobileNumber(value: string): string | null {
  return MOBILE_NUMBER_REGEX.test(value) ? null : 'Enter an 11-digit mobile number (e.g. 09171234567)';
}
function validateEmail(value: string): string | null {
  return EMAIL_REGEX.test(value) ? null : 'Enter a valid email address';
}
function validatePassword(value: string): string | null {
  if (value.length < 8) return 'Password must be at least 8 characters';
  return PASSWORD_COMPLEXITY_REGEX.test(value)
    ? null
    : 'Add an uppercase letter, a number, and a special character';
}

/**
 * Resolves a TextField's error/success pair for one field:
 *  - empty value  → whatever the last submit attempt reported (or nothing yet)
 *  - non-empty    → live format check, so feedback appears as the resident types
 */
function fieldStatus(
  value: string,
  submitError: string | undefined,
  validate?: (value: string) => string | null,
  successMessage = ' ',
): { error?: string; success?: string } {
  if (!value) return submitError ? { error: submitError } : {};
  const message = validate?.(value);
  if (message) return { error: message };
  return { success: successMessage };
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

export default function RegisterScreen({ completingProfile = false }: { completingProfile?: boolean }) {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { setRegistering, refreshCompletion, logout } = useAuth();
  const { refetch: refreshProfile } = useProfile();
  const completionParams = useLocalSearchParams<{ completing?: string; next?: string }>();
  const completing = completionParams.completing === "1" || completingProfile;
  const submitting = useRef(false);

  // Full Name split into structured parts (Register/Profile field-split) — see
  // registerSchema in @barangayan/shared for the required/optional breakdown.
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  // Barangay is displayed from the auto-assigned profile relation below.
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | null>(null);
  const [occupation, setOccupation] = useState('');
  const [birthDateIso, setBirthDateIso] = useState<string | null>(null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);

  const [barangay, setBarangay] = useState<{ id: string; name: string; city: string; province: string; boundary: Polygon | MultiPolygon | null } | null>(null);
  const [localityError, setLocalityError] = useState<string | null>(null);
  const [localityAttempt, setLocalityAttempt] = useState(0);
  const [registrationLocation, setRegistrationLocation] = useState<{ gps: { lat: number; lng: number } | null; home: { lat: number; lng: number } | null }>({ gps: null, home: null });
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
    let active = true;
    const client = supabase;
    void registrationLocality(client).then(data => {
      if (active) { setBarangay({ ...data, boundary: data.boundary as Polygon | MultiPolygon | null }); setLocalityError(null); }
    }).catch(cause => { if (active) setLocalityError(cause.message); });
    if (completing) void client.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || !active) return;
      const { data: profile } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (!active) return;
      const names = residentNamePrefill(user.user_metadata, profile);
      setFirstName(current => current || names.firstName);
      setLastName(current => current || names.lastName);
      setEmail(user.email ?? '');
      if (profile) {
        setMiddleName(profile.middle_name ?? ''); setSuffix(profile.suffix ?? '');
        setHouseNo(profile.house_no ?? ''); setStreet(profile.street ?? ''); setMobileNumber(profile.mobile_number ?? '');
        setSex(profile.sex as Sex | null); setEmploymentStatus(profile.employment_status as EmploymentStatus | null);
        setOccupation(profile.occupation ?? ''); setBirthDateIso(profile.birth_date);
      }
    }).catch(() => { if (active) setError('Unable to load your profile. Check your connection and retry.'); });
    return () => { active = false; };
  }, [completing, localityAttempt]);

  async function handleSubmit() {
    if (submitting.current) return;
    setError(null);
    setFieldErrors({});

    if (!barangay) {
      setError('Barangay not loaded yet — try again in a moment.');
      return;
    }

    const input = {
      firstName,
      lastName,
      middleName: middleName || undefined,
      suffix: suffix || undefined,
      sex: sex ?? undefined,
      mobileNumber: mobileNumber || undefined,
      email,
      houseNo,
      street,
      employmentStatus: employmentStatus ?? undefined,
      occupation: occupation || undefined,
      birthDate: birthDateIso ?? undefined,
      password,
      confirmPassword,
      barangayId: barangay.id,
    };
    const { email: ignoredEmail, password: ignoredPassword, confirmPassword: ignoredConfirm, barangayId: ignoredBarangay, ...profileInput } = input;
    void ignoredEmail; void ignoredPassword; void ignoredConfirm; void ignoredBarangay;
    const result = registerSchema.safeParse(input);
    const profileResult = profileCompletionSchema.safeParse(profileInput);
    const validation = completing ? profileResult : result;

    if (!validation.success) {
      const errors: Record<string, string> = {};
      for (const issue of validation.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    submitting.current = true;
    setLoading(true);
    // Suppress Stack.Protected's auto-redirect into (app) for the duration of the signup —
    // see the isRegistering doc comment in use-auth.tsx for why this is needed.
    if (!completing) setRegistering(true);

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
      if (completing) {
        if (!profileResult.success) return;
        const { error: completionError } = await serviceFoundationOperations(supabase).completeProfile({ ...profileResult.data, location: registrationLocation });
        if (completionError) { setError(completionError.message); return; }
        refreshProfile(); await refreshCompletion(); router.replace(safeResidentRedirect(completionParams.next ?? null) as Href);
        return;
      }
      if (!result.success) return;
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
            employment_status: result.data.employmentStatus,
            occupation: result.data.occupation ?? null,
            birth_date: result.data.birthDate ?? null,
            barangay_id: barangay.id,
            // Soft geofencing flag (0075) — read by handle_new_user(), never blocks signup.
            registration_home: registrationLocation.home,
            registration_gps: registrationLocation.gps,

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
    } catch {
      setError("Could not save your account. Check your connection and retry.");
    } finally {
      submitting.current = false;
      setLoading(false);
      // Session is signed back out (or was never established) by this point, so it's
      // safe to let Stack.Protected's normal guard logic resume.
      if (!completing) setRegistering(false);
      // Only show the success modal on the success path. Error paths set an error
      // message and stay on this screen so the resident can correct and retry.
      if (signUpSucceeded && result.success) {
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
        <AuthHeader title={completing ? 'Complete Profile' : 'Create Account'} onBack={() => { if (completing) router.replace('/home'); else router.replace('/(auth)/auth-choice'); }} />

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
                <TextField
                  label="First Name"
                  required
                  value={firstName}
                  onChangeText={setFirstName}
                  {...fieldStatus(firstName, fieldErrors.firstName, validateName)}
                />
              </View>
              <View style={styles.fieldPairItem}>
                <TextField
                  label="Last Name"
                  required
                  value={lastName}
                  onChangeText={setLastName}
                  {...fieldStatus(lastName, fieldErrors.lastName, validateName)}
                />
              </View>
            </View>
            <View style={styles.fieldPairRow}>
              <View style={styles.fieldPairItem}>
                <TextField
                  label="Middle Name (optional)"
                  value={middleName}
                  onChangeText={setMiddleName}
                  {...fieldStatus(middleName, fieldErrors.middleName, validateName)}
                />
              </View>
              <View style={styles.fieldPairItem}>
                <TextField
                  label="Suffix (optional)"
                  value={suffix}
                  onChangeText={setSuffix}
                  {...fieldStatus(suffix, fieldErrors.suffix, validateName)}
                />
              </View>
            </View>

            <View style={styles.choiceField}>
              <ThemedText type="small">
                Sex
                <RequiredMark />
              </ThemedText>
              <ChoiceChips options={SEXES} labels={SEX_LABELS} active={sex} onChange={setSex} />
              {fieldErrors.sex ? (
                <ThemedText type="small" themeColor="accentRed">
                  {fieldErrors.sex}
                </ThemedText>
              ) : null}
            </View>

            <View style={styles.birthdayField}>
              <ThemedText type="small">
                Date of Birth
                <RequiredMark />
              </ThemedText>
              <Pressable
                onPress={() => setShowBirthPicker(true)}
                accessibilityRole="button"
                accessibilityLabel="Select date of birth"
                style={[
                  styles.birthdayInput,
                  { backgroundColor: theme.background, borderColor: theme.backgroundSelected },
                ]}>
                <ThemedText style={birthDateIso ? undefined : { color: theme.textSecondary }}>
                  {birthDateIso ? fmtDate(birthDateIso) : 'Select your date of birth'}
                </ThemedText>
                <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
              </Pressable>
              {fieldErrors.birthDate ? (
                <ThemedText type="small" themeColor="accentRed">
                  {fieldErrors.birthDate}
                </ThemedText>
              ) : birthDateIso ? (
                <View style={styles.inlineStatusRow}>
                  <Ionicons name="checkmark-circle-outline" size={14} color={theme.accentGreen} />
                  <ThemedText type="small" themeColor="accentGreen">
                    
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </FormSection>

          <FormSection icon="call-outline" title="Contact & Address">
            <TextField
              label="Mobile Number"
              required
              keyboardType="phone-pad"
              maxLength={11}
              placeholder="09171234567"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              {...fieldStatus(mobileNumber, fieldErrors.mobileNumber, validateMobileNumber)}
            />
            <TextField
              label="Email Address"
              editable={!completing}
              required
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              {...fieldStatus(email, fieldErrors.email, validateEmail)}
            />

            <View style={styles.fieldPairRow}>
              <View style={[styles.fieldPairItem, { flex: 1 }]}>
                <TextField
                  label="House No."
                  required
                  value={houseNo}
                  onChangeText={setHouseNo}
                  {...fieldStatus(houseNo, fieldErrors.houseNo)}
                />
              </View>
              <View style={[styles.fieldPairItem, { flex: 2 }]}>
                <TextField
                  label="Street"
                  required
                  value={street}
                  onChangeText={setStreet}
                  {...fieldStatus(street, fieldErrors.street)}
                />
              </View>
            </View>
            <View style={[styles.barangayRow, { backgroundColor: theme.background, borderColor: theme.backgroundSelected }]}>
              <ThemedText type="small" themeColor="textSecondary">Barangay</ThemedText>
              <ThemedText type="smallBold">{barangay?.name ?? 'Loading…'}</ThemedText>
            </View>
          </FormSection>

          <TextField label="City" value={barangay?.city ?? ''} editable={false} />
          <TextField label="Province" value={barangay?.province ?? ''} editable={false} />
          <FormSection icon="briefcase-outline" title="Employment">
            <View style={styles.choiceField}>
              <ThemedText type="small">
                Employment Status
                <RequiredMark />
              </ThemedText>
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

          {!completing && <FormSection icon="lock-closed-outline" title="Account Security">
            <TextField
              label="Password"
              required
              secureTextEntry={!isPasswordVisible}
              value={password}
              onChangeText={setPassword}
              {...fieldStatus(password, fieldErrors.password, validatePassword, 'Password strength: good')}
              passwordVisibility={{
                visible: isPasswordVisible,
                onToggle: () => setIsPasswordVisible((visible) => !visible),
              }}
            />
            <ThemedText type="small" themeColor="textSecondary">
              Use 8+ characters with at least one uppercase letter, one number, and one special character.
            </ThemedText>
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
          </FormSection>}

          <RegistrationMap boundary={barangay?.boundary ?? null} onConfirm={setRegistrationLocation} />
          {localityError && <><ThemedText themeColor="accentRed">{localityError}</ThemedText><PrimaryButton label="Retry locality" onPress={() => setLocalityAttempt(value => value + 1)} /></>}
          {completing && <PrimaryButton label="Skip for now — browse information" variant="secondary" onPress={() => router.replace('/home')} />}
          {!completing && <GoogleButton label="Sign up with Google" />}
          {error ? (
            <ThemedText type="small" themeColor="accentRed" style={styles.formError}>
              {error}
            </ThemedText>
          ) : null}

          <View style={styles.submitActions}>
            {completing && <PrimaryButton label="Sign out" variant="secondary" onPress={() => { void logout(); }} />}
            <PrimaryButton label={completing ? "Complete Profile" : "Create Account"} loading={loading} onPress={handleSubmit} />
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
  inlineStatusRow: {
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
