'use client';
import { GoogleButton } from '@/components/auth/google-button';
import { RegistrationMap } from '@/components/auth/registration-map';

import {
  EMAIL_REGEX,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  profileCompletionSchema,
  serviceFoundationOperations,
  registrationLocality,
  residentNamePrefill,
  safeResidentRedirect,
  MOBILE_NUMBER_REGEX,
  NAME_REGEX,
  PASSWORD_COMPLEXITY_REGEX,
  registerSchema,
  SEXES,
  type EmploymentStatus,
  type Sex,
} from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { AlertCircle, Briefcase, CheckCircle2, type LucideIcon, Lock, MapPinned, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

const SEX_LABELS: Record<Sex, string> = { male: 'Male', female: 'Female' };

const EMPLOYMENT_STATUS_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed',
  unemployed: 'Unemployed',
  student: 'Student',
  self_employed: 'Self-Employed',
  retired: 'Retired',
};

/** Red asterisk suffix for required-field labels — purely visual, mirrors the mobile
 * Register screen's RequiredMark. Validation itself is still driven by registerSchema. */
function RequiredMark() {
  return <span className="text-destructive"> *</span>;
}

// ─── Live per-field validation ────────────────────────────────────────────────
// Runs the same rules as registerSchema (packages/shared), as-you-type, so a field
// shows a red alert or a green check the moment its value becomes invalid/valid —
// the same treatment the Confirm Password field already gave the password-match
// check, generalized to every field. Mirrors apps/resident-android-mobile's
// register.tsx validators exactly so the two apps never drift apart.
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
  return PASSWORD_COMPLEXITY_REGEX.test(value) ? null : 'Add an uppercase letter, a number, and a special character';
}

/**
 * Resolves a field's error/success pair:
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

/** Red-alert / green-check row rendered below a field, mirroring the "Passwords
 * match" / "Passwords don't match" treatment generalized to every field. */
function FieldStatus({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p className="flex items-center gap-1 text-xs text-destructive">
        <AlertCircle size={12} />
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p className="flex items-center gap-1 text-xs text-primary">
        <CheckCircle2 size={12} />
        {success}
      </p>
    );
  }
  return null;
}

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
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isActive = active === option;
        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={isActive}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground',
            )}>
            {labels[option]}
          </button>
        );
      })}
    </div>
  );
}

/** Compact section label used to break the long form into scannable groups without
 * spending a full card/border per section. */
function SectionHeading({ icon: Icon, title }: { icon: LucideIcon; title: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border pb-2">
      <Icon size={15} className="text-primary" />
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>
    </div>
  );
}

/**
 * Migrated from apps/resident-android-mobile/src/app/(auth)/register.tsx — same
 * structured field set (registerSchema in @barangayan/shared), same profile-fields-as-
 * signup-metadata pattern (handle_new_user trigger creates profiles atomically), same
 * advisory map check (never blocks registration), and the same live-validation / required-mark / green-check
 * treatment as mobile's TextField (see fieldStatus/FieldStatus/RequiredMark above).
 * Uses the browser Geolocation API in place of expo-location, and a native
 * <input type="date"> in place of the mobile calendar modal.
 *
 * Fields are grouped into labeled sections (Personal / Address / Employment /
 * Security / Location) with tighter grids and gaps than a flat field list would use —
 * this form has a lot of fields, and section grouping keeps it scannable without
 * needing a multi-step wizard.
 */
export function RegisterForm({ completing = false }: { completing?: boolean }) {
  const router = useRouter();
  const submitting = useRef(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | null>(null);
  const [occupation, setOccupation] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [barangay, setBarangay] = useState<{ id: string; name: string; city: string; province: string; boundary: Polygon | MultiPolygon | null } | null>(null);
  const [localityError, setLocalityError] = useState<string | null>(null);
  const [localityAttempt, setLocalityAttempt] = useState(0);
  const [registrationLocation, setRegistrationLocation] = useState<{ gps: { lat: number; lng: number } | null; home: { lat: number; lng: number } | null }>({ gps: null, home: null });
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successEmail, setSuccessEmail] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const hasEnteredBothPasswords = password.length > 0 && confirmPassword.length > 0;
  const passwordsMatch = hasEnteredBothPasswords && password === confirmPassword;
  const confirmPasswordError = fieldErrors.confirmPassword === "Passwords don't match" ? undefined : fieldErrors.confirmPassword;

  // Live status for every field with a format check — computed once per render so the
  // input's aria-invalid and the FieldStatus row below it never disagree.
  const firstNameStatus = fieldStatus(firstName, fieldErrors.firstName, validateName);
  const lastNameStatus = fieldStatus(lastName, fieldErrors.lastName, validateName);
  const middleNameStatus = fieldStatus(middleName, fieldErrors.middleName, validateName);
  const suffixStatus = fieldStatus(suffix, fieldErrors.suffix, validateName);
  const emailStatus = fieldStatus(email, fieldErrors.email, validateEmail);
  const mobileNumberStatus = fieldStatus(mobileNumber, fieldErrors.mobileNumber, validateMobileNumber);
  const houseNoStatus = fieldStatus(houseNo, fieldErrors.houseNo);
  const streetStatus = fieldStatus(street, fieldErrors.street);
  const passwordStatus = fieldStatus(password, fieldErrors.password, validatePassword, 'Password strength: good');

  useEffect(() => {
    let active = true;
    const client = createSupabaseBrowserClient();
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
        setOccupation(profile.occupation ?? ''); setBirthDate(profile.birth_date ?? '');
      }
    }).catch(() => { if (active) setError('Unable to load your profile. Check your connection and retry.'); });
    return () => { active = false; };
  }, [completing, localityAttempt]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
      birthDate: birthDate || undefined,
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
    let signUpSucceeded = false;
    try {
      const supabase = createSupabaseBrowserClient();
      if (completing) {
        if (!profileResult.success) return;
        const { error: completionError } = await serviceFoundationOperations(supabase).completeProfile({ ...profileResult.data, location: registrationLocation });
        if (completionError) { setError(completionError.message); return; }
        router.replace(safeResidentRedirect(new URLSearchParams(window.location.search).get('next'))); router.refresh();
        return;
      }
      if (!result.success) return;
      // Profile fields travel as signup metadata so the handle_new_user() database
      // trigger can create the profiles row atomically with the auth.users row.
      // full_name/home_address are not sent — migration 0081's
      // compose_profiles_display_fields() trigger derives both from these structured
      // fields.
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
            registration_home: registrationLocation.home,
            registration_gps: registrationLocation.gps,

          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      if (!signUpData.session) {
        setError(
          'Account creation requires email confirmation, but that is not yet supported. Please contact support or try again later.',
        );
        return;
      }

      // Local scope only — clears this device's session without revoking tokens
      // elsewhere. The resident must go through Login explicitly afterward.
      await supabase.auth.signOut({ scope: 'local' });
      signUpSucceeded = true;
    } catch {
      setError("Could not save your account. Check your connection and retry.");
    } finally {
      submitting.current = false;
      setLoading(false);
      if (signUpSucceeded && result.success) {
        setSuccessEmail(result.data.email);
        setShowSuccessModal(true);
      }
    }
  }

  function goToLogin() {
    setShowSuccessModal(false);
    router.replace(successEmail ? `/login?email=${encodeURIComponent(successEmail)}` : '/login');
  }

  return (
    <>
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CheckCircle2 size={30} />
            </div>
            <DialogTitle>Account Created Successfully</DialogTitle>
            <DialogDescription>Your account is ready. Log in to continue to Barangayan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setShowSuccessModal(false)} className="flex-1">
              OK
            </Button>
            <Button onClick={goToLogin} className="flex-1">
              Proceed to Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <form onSubmit={handleSubmit} className="flex flex-col gap-7">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{completing ? "Complete your resident profile" : "Create Account"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">Please fill in your details to get started.</p>
        </div>

        {/* ── Personal Details ───────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SectionHeading icon={User} title="Personal Details" />

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="firstName">
                First Name
                <RequiredMark />
              </Label>
              <Input
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                aria-invalid={!!firstNameStatus.error}
              />
              <FieldStatus {...firstNameStatus} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="lastName">
                Last Name
                <RequiredMark />
              </Label>
              <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} aria-invalid={!!lastNameStatus.error} />
              <FieldStatus {...lastNameStatus} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                placeholder="Optional"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                aria-invalid={!!middleNameStatus.error}
              />
              <FieldStatus {...middleNameStatus} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="suffix">Suffix</Label>
              <Input
                id="suffix"
                placeholder="Optional"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                aria-invalid={!!suffixStatus.error}
              />
              <FieldStatus {...suffixStatus} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>
                Sex
                <RequiredMark />
              </Label>
              <ChoiceChips options={SEXES} labels={SEX_LABELS} active={sex} onChange={setSex} />
              {fieldErrors.sex ? <FieldStatus error={fieldErrors.sex} /> : sex ? <FieldStatus success=" " /> : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="birthDate">
                Date of Birth
                <RequiredMark />
              </Label>
              <Input
                id="birthDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                aria-invalid={!!fieldErrors.birthDate}
              />
              {fieldErrors.birthDate ? <FieldStatus error={fieldErrors.birthDate} /> : birthDate ? <FieldStatus success=" " /> : null}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                Email Address
                <RequiredMark />
              </Label>
              <Input
                id="email"
                readOnly={completing}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!emailStatus.error}
              />
              <FieldStatus {...emailStatus} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mobileNumber">
                Mobile Number
                <RequiredMark />
              </Label>
              <Input
                id="mobileNumber"
                type="tel"
                inputMode="numeric"
                maxLength={11}
                placeholder="09171234567"
                value={mobileNumber}
                onChange={(e) => setMobileNumber(e.target.value)}
                aria-invalid={!!mobileNumberStatus.error}
              />
              <FieldStatus {...mobileNumberStatus} />
            </div>
          </div>
        </div>

        {/* ── Address ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SectionHeading icon={MapPinned} title="Address" />

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1 flex flex-col gap-1.5">
              <Label htmlFor="houseNo">
                House No.
                <RequiredMark />
              </Label>
              <Input id="houseNo" value={houseNo} onChange={(e) => setHouseNo(e.target.value)} aria-invalid={!!houseNoStatus.error} />
              <FieldStatus {...houseNoStatus} />
            </div>
            <div className="col-span-2 flex flex-col gap-1.5">
              <Label htmlFor="street">
                Street
                <RequiredMark />
              </Label>
              <Input id="street" value={street} onChange={(e) => setStreet(e.target.value)} aria-invalid={!!streetStatus.error} />
              <FieldStatus {...streetStatus} />
            </div>
          </div>

          <div className="flex h-11 items-center justify-between rounded-lg border border-border bg-card px-3.5">
            <span className="text-sm text-muted-foreground">Barangay</span>
            <span className="text-sm font-semibold">{barangay?.name ?? 'Loading…'}</span>
          </div>
        </div>

        <Label>City<Input value={barangay?.city ?? ''} readOnly className="bg-muted" /></Label>
        <Label>Province<Input value={barangay?.province ?? ''} readOnly className="bg-muted" /></Label>
        {/* ── Employment ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SectionHeading icon={Briefcase} title="Employment" />

          <div className="flex flex-col gap-1.5">
            <Label>
              Employment Status
              <RequiredMark />
            </Label>
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
              <FieldStatus error={fieldErrors.employmentStatus} />
            ) : employmentStatus ? (
              <FieldStatus success=" " />
            ) : null}
          </div>

          {employmentStatus && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus) ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="occupation">Occupation (optional)</Label>
              <Input id="occupation" value={occupation} onChange={(e) => setOccupation(e.target.value)} />
            </div>
          ) : null}
        </div>

        {!completing && <>
        {/* ── Security ────────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <SectionHeading icon={Lock} title="Security" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                Password
                <RequiredMark />
              </Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!passwordStatus.error}
              />
              <p className="text-xs text-muted-foreground">
                Use 8+ characters with at least one uppercase letter, one number, and one special character.
              </p>
              <FieldStatus {...passwordStatus} />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-invalid={!!confirmPasswordError || (hasEnteredBothPasswords && !passwordsMatch)}
              />
              {confirmPasswordError ? <p className="text-xs text-destructive">{confirmPasswordError}</p> : null}
              {hasEnteredBothPasswords ? (
                <p className={cn('flex items-center gap-1 text-xs', passwordsMatch ? 'text-primary' : 'text-destructive')}>
                  {passwordsMatch ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                  {passwordsMatch ? 'Passwords match' : "Passwords don't match"}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        </>}
        <RegistrationMap boundary={barangay?.boundary ?? null} onConfirm={setRegistrationLocation} />
        {localityError && <><p role="alert">{localityError}</p><Button type="button" onClick={() => setLocalityAttempt(value => value + 1)}>Retry locality</Button></>}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col items-center gap-3">
          {completing && <Button type="button" variant="secondary" onClick={async () => { await createSupabaseBrowserClient().auth.signOut({ scope: 'local' }); router.replace('/login'); router.refresh(); }}>Sign out</Button>}
          <Button type="submit" size="lg" loading={loading} className="w-full">
            {completing ? "Complete Profile" : "Create Account"}
          </Button>
          {completing && <Button type="button" variant="secondary" className="w-full" onClick={() => { router.replace('/home'); router.refresh(); }}>Skip for now — browse information</Button>}
          {!completing && <div className="w-full"><GoogleButton label="Sign up with Google" /></div>}
          <p className="text-sm text-muted-foreground">
            Already have an account?{' '}
            <button type="button" onClick={() => router.push('/login')} className="font-medium text-primary hover:underline">
              Log in
            </button>
          </p>
        </div>
      </form>
    </>
  );
}
