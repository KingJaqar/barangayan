import { EMPLOYMENT_STATUSES, EMPLOYMENT_STATUSES_WITH_OCCUPATION, residentDetailsStepSchema, registrationLocality, RegistrationLocalityError, ResidentSetupStatusError, residentNamePrefill, MOBILE_NUMBER_REGEX, NAME_REGEX, SEXES, type EmploymentStatus, type Sex, type Tables, type Json } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthHeader } from './auth-header';
import { BirthdayCalendarModal, dateToIso, isoToLocalDate } from './birthday-calendar-modal';
import { PrimaryButton } from './primary-button';
import { RegistrationMap } from './registration-map';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { authSetupRequests, profileSetupRequests, SetupOwner, SetupTimeout } from '@/lib/setup-request';

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
export function FormSection({
  icon,
  title,
  children,
  compact,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  children: React.ReactNode;
  /** Tighter padding/gaps for short sections that must fit above the keyboard. */
  compact?: boolean;
}) {
  const theme = useTheme();
  return (
    <View style={[sectionStyles.card, compact && sectionStyles.cardCompact, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}>
      <View style={sectionStyles.titleRow}>
        <Ionicons name={icon} size={16} color={theme.primary} />
        <ThemedText style={sectionStyles.title}>{title}</ThemedText>
      </View>
      <View style={[sectionStyles.body, compact && sectionStyles.bodyCompact]}>{children}</View>
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
  cardCompact: { padding: Spacing.three - 4, gap: Spacing.two },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  title: { fontSize: 14, fontWeight: '700' },
  body: { gap: Spacing.three },
  bodyCompact: { gap: Spacing.two },
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



/** Registration and deferred completion share the restored form and validators. */
export function ResidentDetailsForm({ required, onSaved, onSkip, onBack }: { required: boolean; onSaved: () => Promise<void>; onSkip: () => void; onBack: () => void }) {
  const theme = useTheme(), insets = useSafeAreaInsets();
  const { session, logout } = useAuth();
  const { refetch: refreshProfile } = useProfile();
  const owner = useRef(new SetupOwner());
  const uid = session?.user.id;
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const email = session?.user.email ?? '';
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | null>(null);
  const [occupation, setOccupation] = useState('');
  const [birthDateIso, setBirthDateIso] = useState<string | null>(null);
  const [showBirthPicker, setShowBirthPicker] = useState(false);
  const [barangay, setBarangay] = useState<{ id: string; name: string; city: string; province: string; boundary: Polygon | MultiPolygon | null } | null>(null);
  const [registrationLocation, setRegistrationLocation] = useState<{ gps: { lat: number; lng: number } | null; home: { lat: number; lng: number } | null }>({ gps: null, home: null });
  const [snapshot, setSnapshot] = useState<Tables<'profiles'> | null>(null);
  const [ready, setReady] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [loadFailure, setLoadFailure] = useState<{ message: string; retryable: boolean } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const editable = !loading && !uncertain && !conflict;

  useEffect(() => {
    const scope = owner.current; scope.invalidate(); const owns = scope.ticket();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
    setReady(false); setInitializing(true); setLoadFailure(null); setError(null); setConflict(false); setUncertain(false);
    const load = async () => {
      if (!uid) throw new ResidentSetupStatusError({ name: 'AuthSessionMissingError' });
      const result = await supabase.from('profiles').select('*').eq('id', uid).abortSignal(controller.signal).maybeSingle();
      if (!owns()) return;
      if (result.error) throw new ResidentSetupStatusError({ code: result.error.code, status: result.status });
      const p = result.data;
      if (p && (p.id !== uid || p.role !== 'resident' || p.deleted_at)) throw new ResidentSetupStatusError({ code: '42501' });
      const locality = await registrationLocality(supabase, { barangayId: p?.barangay_id, signal: controller.signal });
      if (!owns()) return;
      if (controller.signal.aborted) throw new RegistrationLocalityError('locality', true);
      const names = residentNamePrefill(session?.user.user_metadata, p);
      setFirstName(names.firstName); setLastName(names.lastName);
      setMiddleName(p?.middle_name ?? ''); setSuffix(p?.suffix ?? '');
      setHouseNo(p?.house_no ?? ''); setStreet(p?.street ?? ''); setMobileNumber(p?.mobile_number ?? '');
      setSex(p?.sex as Sex | null ?? null); setEmploymentStatus(p?.employment_status as EmploymentStatus | null ?? null);
      setOccupation(p?.occupation ?? ''); setBirthDateIso(p?.birth_date ?? null);
      const point = (value: Json | null | undefined) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.lat === 'number' && typeof value.lng === 'number' ? { lat: value.lat, lng: value.lng } : null;
      setRegistrationLocation({ gps: point(p?.registration_location), home: point(p?.registration_home_location) });
      setSnapshot(p); setBarangay({ ...locality, boundary: locality.boundary as Polygon | MultiPolygon | null }); setReady(true);
    };
    void load().catch(cause => {
      if (!owns()) return;
      setLoadFailure(cause instanceof ResidentSetupStatusError
        ? ['unknown', 'network', 'state_unavailable'].includes(cause.failure.kind)
          ? { message: 'Unable to load your profile. Check your connection and retry.', retryable: true }
          : cause.failure
        : cause instanceof RegistrationLocalityError
          ? { message: cause.message, retryable: cause.retryable }
          : { message: 'Unable to load your profile. Check your connection and retry.', retryable: true });
    }).finally(() => { clearTimeout(timer); if (owns()) setInitializing(false); });
    return () => { scope.invalidate(); controller.abort(); clearTimeout(timer); };
    // Fresh profile belongs to this account/load attempt, not an offline context cache.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, attempt]);

  async function handleSubmit() {
    if (!ready || initializing || loadFailure || loading || conflict) return;
    const owns = owner.current.ticket();
    const parsed = residentDetailsStepSchema.safeParse({ firstName, lastName, middleName: middleName.trim() || undefined, suffix: suffix.trim() || undefined,
      sex: sex ?? undefined, mobileNumber, houseNo, street, employmentStatus: employmentStatus ?? undefined,
      occupation: occupation.trim() || undefined, birthDate: birthDateIso ?? undefined, location: registrationLocation });
    setError(null); setFieldErrors({});
    if (!parsed.success) { setFieldErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    if (uncertain) { setError('Review the current saved profile before retrying.'); return; }
    setLoading(true);
    const controller = new AbortController();
    try {
      const result = await profileSetupRequests.run(async () => {
        const { data, error: saveError } = await supabase.rpc('complete_resident_profile_if_unchanged', { p_input: parsed.data, p_expected: snapshot }).abortSignal(controller.signal);
        if (saveError) throw saveError;
        return data;
      });
      if (!owns()) return;
      if (!result) throw new Error('Profile completion could not be confirmed.');
      void refreshProfile(); await onSaved();
    } catch (cause) {
      if (!owns()) return;
      const code = (cause as { code?: string }).code;
      setConflict(code === 'PT409');
      // A lost response may have committed. Reload/review before any repeat write.
      setUncertain(code !== 'PT409' && code !== '22023' && code !== '42501');
      setError(code === 'PT409' ? 'Your profile changed on another screen or device. Reload and review the current details before saving.' : code === '42501' ? 'This account cannot complete resident setup. Sign out and use the correct account.' : code === '22023' ? 'Check your details and registration locality, then retry.' : cause instanceof SetupTimeout ? cause.message : 'The save could not be confirmed. Reload and review your saved profile before retrying.');
    } finally { controller.abort(); if (owns()) setLoading(false); }
  }

  function leave(action: () => void) {
    if (authSetupRequests.busy || profileSetupRequests.busy) { setError('The earlier request is still finishing. Please wait before leaving this step.'); return; }
    action();
  }

  const FormContainer = Platform.OS === 'android' ? KeyboardAvoidingView : View;
  const keyboardProps = Platform.OS === 'android' ? { behavior: 'height' as const } : {};

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]} edges={['top', 'left', 'right']}>
      <FormContainer {...keyboardProps} style={[styles.root, { backgroundColor: theme.background }]}>
        <AuthHeader title="Complete Profile" onBack={() => leave(onBack)} />
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.five }]} keyboardShouldPersistTaps="handled">
          <ThemedText style={styles.introTitle}>Let&apos;s get you set up</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.introSubtitle}>Fill in your details to register with your local barangay.</ThemedText>
          {initializing && <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.two }}>
            <ActivityIndicator color={theme.primary} />
            <ThemedText accessibilityLiveRegion="polite">Loading your profile…</ThemedText>
          </View>}
          {ready && <View style={{ gap: Spacing.three }} pointerEvents={loading || uncertain || conflict ? 'none' : 'auto'}>
                    <FormSection icon="person-outline" title="Personal Information">
            <View style={styles.fieldPairRow}>
              <View style={styles.fieldPairItem}>
                <TextField
                  label="First Name" accessibilityLabel="First Name"
                  editable={editable}
                  required
                  value={firstName}
                  onChangeText={setFirstName}
                  {...fieldStatus(firstName, fieldErrors.firstName, validateName)}
                />
              </View>
              <View style={styles.fieldPairItem}>
                <TextField
                  label="Last Name" accessibilityLabel="Last Name"
                  editable={editable}
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
                  label="Middle Name (optional)" accessibilityLabel="Middle Name (optional)"
                  editable={editable}
                  value={middleName}
                  onChangeText={setMiddleName}
                  {...fieldStatus(middleName, fieldErrors.middleName)}
                />
              </View>
              <View style={styles.fieldPairItem}>
                <TextField
                  label="Suffix (optional)" accessibilityLabel="Suffix (optional)"
                  editable={editable}
                  value={suffix}
                  onChangeText={setSuffix}
                  {...fieldStatus(suffix, fieldErrors.suffix)}
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
              label="Mobile Number" accessibilityLabel="Mobile Number"
              editable={editable}
              required
              keyboardType="phone-pad"
              maxLength={11}
              placeholder="09171234567"
              value={mobileNumber}
              onChangeText={setMobileNumber}
              {...fieldStatus(mobileNumber, fieldErrors.mobileNumber, validateMobileNumber)}
            />
            <TextField
              label="Email Address" accessibilityLabel="Email Address"
              editable={false}
              required
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}

            />

            <View style={styles.fieldPairRow}>
              <View style={[styles.fieldPairItem, { flex: 1 }]}>
                <TextField
                  label="House No." accessibilityLabel="House No."
                  editable={editable}
                  required
                  value={houseNo}
                  onChangeText={setHouseNo}
                  {...fieldStatus(houseNo, fieldErrors.houseNo)}
                />
              </View>
              <View style={[styles.fieldPairItem, { flex: 2 }]}>
                <TextField
                  label="Street" accessibilityLabel="Street"
                  editable={editable}
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

          <TextField label="City" accessibilityLabel="City" value={barangay?.city ?? ''} editable={false} />
          <TextField label="Province" accessibilityLabel="Province" value={barangay?.province ?? ''} editable={false} />
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
              <TextField label="Occupation (optional)" accessibilityLabel="Occupation (optional)" editable={editable} value={occupation} onChangeText={setOccupation} />
            ) : null}
          </FormSection>


          <RegistrationMap key={attempt} boundary={barangay?.boundary ?? null} initialValue={registrationLocation} onConfirm={setRegistrationLocation} />
          </View>}
          {loadFailure && <ThemedText accessibilityRole="alert" themeColor="accentRed">{loadFailure.message}</ThemedText>}
          {error && <ThemedText accessibilityLiveRegion="polite" themeColor="accentRed">{error}</ThemedText>}
          {(!initializing && (loadFailure?.retryable || conflict || uncertain)) && <PrimaryButton label="Reload and review current profile" accessibilityLabel="Reload and review current profile" variant="secondary" onPress={() => {
            if (profileSetupRequests.busy) { setError('The earlier save is still finishing. Please wait before reloading.'); return; }
            setAttempt(value => value + 1);
          }} />}
          {ready && <PrimaryButton label={required ? 'Next' : 'Confirm personal details'} accessibilityLabel={required ? 'Next' : 'Confirm personal details'} loading={loading} disabled={conflict || uncertain} onPress={handleSubmit} />}
          {!required && <PrimaryButton label={loadFailure && !loadFailure.retryable ? 'Back to Home' : 'Skip for now'} accessibilityLabel={loadFailure && !loadFailure.retryable ? 'Back to Home' : 'Skip for now'} variant="secondary" disabled={loading} onPress={() => leave(onSkip)} />}
          <PrimaryButton label="Sign out" accessibilityLabel="Sign out" variant="secondary" disabled={loading} onPress={() => leave(() => { void logout(); })} />
        </ScrollView>
        </KeyboardAvoidingView>
      </FormContainer>
      <BirthdayCalendarModal visible={showBirthPicker} value={birthDateIso ? isoToLocalDate(birthDateIso) : null} onClose={() => setShowBirthPicker(false)} onSave={date => { setBirthDateIso(dateToIso(date)); setShowBirthPicker(false); }} />
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
});

