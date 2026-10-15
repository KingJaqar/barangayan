import {
  EMPLOYMENT_STATUSES, EMPLOYMENT_STATUSES_WITH_OCCUPATION, MOBILE_NUMBER_REGEX, NAME_REGEX, SEXES,
  isPointInPolygon, registrationLocality, residentDetailsStepSchema, residentNamePrefill,
  type EmploymentStatus, type Json, type Sex, type Tables,
} from '@barangayan/shared';
import type { MultiPolygon, Polygon } from 'geojson';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { authRequests, Ownership, profileRequests, SetupTimeout } from '../../auth/request-gate';
import { Action, Body, Card, Field, Notice, Screen, Selector } from '../../components/ui';
import { birthdayLabel } from '../profile/birthday';
import { BirthdaySheet } from '../profile/birthday-sheet';
import { HomePinCard } from '../profile/home-pin';
import { useDeviceLocation } from '../../lib/device-location';
import { useResident } from '../../lib/runtime';
import { layout, radius, space, typeScale, useColors } from '../../lib/theme';
import { useLatest } from '../../lib/use-latest';
import { EmergencyEntry } from './parts';

const SEX_OPTIONS = SEXES.map((value) => ({ value, label: value === 'male' ? 'Male' : 'Female' }));
const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  employed: 'Employed', unemployed: 'Unemployed', student: 'Student', self_employed: 'Self-employed', retired: 'Retired',
};
const EMPLOYMENT_OPTIONS = EMPLOYMENT_STATUSES.map((value) => ({ value, label: EMPLOYMENT_LABELS[value] }));

function isoDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function parseIso(value: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day, 12) : null;
}
const nameIssue = (value: string) => NAME_REGEX.test(value) ? undefined : 'Letters only — no numbers or symbols';
const mobileIssue = (value: string) => MOBILE_NUMBER_REGEX.test(value) ? undefined : 'Enter an 11-digit mobile number (for example 09171234567)';
/** Live format feedback once there is a value; an empty field reports only the last submit result. */
const live = (value: string, submit: string | undefined, check?: (value: string) => string | undefined) =>
  value ? check?.(value) : submit;

type Locality = { id: string; name: string; city: string; province: string; boundary: Polygon | MultiPolygon | null };

/**
 * Resident details for registration and deferred completion. Values come from the server's
 * profile row and the configured registration locality; the save is a conditional write, so a
 * profile changed elsewhere is reported for review instead of being overwritten.
 */
export function DetailsForm({ required, onSaved, onSkip, onSignOut, onReview }: {
  required: boolean;
  onSaved: () => Promise<void>;
  onSkip?: () => void;
  onSignOut: () => void;
  onReview?: () => void;
}) {
  const { client, session } = useResident();
  const colors = useColors();
  const owner = useRef(new Ownership());
  const uid = session?.user.id;
  const email = session?.user.email ?? '';
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [sex, setSex] = useState<Sex | ''>('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | ''>('');
  const [occupation, setOccupation] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [birthdayOpen, setBirthdayOpen] = useState(false);
  const [locality, setLocality] = useState<Locality | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [home, setHome] = useState<{ lat: number; lng: number } | null>(null);
  const [snapshot, setSnapshot] = useState<Tables<'profiles'> | null>(null);
  const [attempt, setAttempt] = useState(0);
  // A load belongs to one account and one explicit attempt; a stale result is simply not "ready".
  const loadKey = `${uid ?? ''}:${attempt}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const ready = loadedKey === loadKey;
  const loadFailed = failedKey === loadKey;
  const sessionRef = useLatest(session);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [locating, setLocating] = useState(false);
  const editable = !busy && !uncertain && !conflict;

  useEffect(() => {
    if (!uid) return;
    const scope = owner.current;
    scope.invalidate();
    const owns = scope.ticket();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    {
      void Promise.all([
        registrationLocality(client),
        client.from('profiles').select('*').eq('id', uid).abortSignal(controller.signal).maybeSingle(),
      ]).then(([place, result]) => {
        if (!owns()) return;
        if (result.error) throw result.error;
        const profile = result.data;
        if (profile && (profile.role !== 'resident' || profile.deleted_at)) throw new Error('denied');
        const names = residentNamePrefill(sessionRef.current?.user.user_metadata, profile);
        setFirstName(names.firstName); setLastName(names.lastName);
        setMiddleName(profile?.middle_name ?? ''); setSuffix(profile?.suffix ?? '');
        setHouseNo(profile?.house_no ?? ''); setStreet(profile?.street ?? ''); setMobileNumber(profile?.mobile_number ?? '');
        setSex(profile?.sex === 'male' || profile?.sex === 'female' ? profile.sex : '');
        const status = EMPLOYMENT_STATUSES.find((value) => value === profile?.employment_status);
        setEmploymentStatus(status ?? '');
        setOccupation(profile?.occupation ?? '');
        setBirthDate(parseIso(profile?.birth_date ?? null));
        const point = (value: Json | null | undefined) => value && typeof value === 'object' && !Array.isArray(value) && typeof value.lat === 'number' && typeof value.lng === 'number' ? { lat: value.lat, lng: value.lng } : null;
        setGps(point(profile?.registration_location)); setHome(point(profile?.registration_home_location));
        setSnapshot(profile);
        setLocality({ ...place, boundary: place.boundary as Polygon | MultiPolygon | null });
        setConflict(false); setUncertain(false);
        setLoadedKey(loadKey);
      }).catch(() => { if (owns()) setFailedKey(loadKey); })
        .finally(() => clearTimeout(timer));
    }
    return () => { scope.invalidate(); controller.abort(); clearTimeout(timer); };
    // Reload only for this account and an explicit retry, never for token refreshes.
  }, [uid, attempt, client, loadKey, sessionRef]);

  async function save() {
    if (!ready || busy) return;
    const owns = owner.current.ticket();
    const parsed = residentDetailsStepSchema.safeParse({
      firstName: firstName.trim(), lastName: lastName.trim(), middleName: middleName.trim() || undefined, suffix: suffix.trim() || undefined,
      sex: sex || undefined, mobileNumber: mobileNumber.trim(), houseNo: houseNo.trim(), street: street.trim(),
      employmentStatus: employmentStatus || undefined, occupation: occupation.trim() || undefined,
      birthDate: birthDate ? isoDate(birthDate) : undefined, location: { gps, home },
    });
    setError(''); setFieldErrors({});
    if (!parsed.success) {
      setFieldErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      setError('Check the highlighted fields.');
      return;
    }
    if (uncertain) { setError('Review the current saved profile before saving again.'); return; }
    setBusy(true);
    const controller = new AbortController();
    try {
      const result = await profileRequests.run(async () => {
        const { data, error: saveError } = await client.rpc('complete_resident_profile_if_unchanged', { p_input: parsed.data, p_expected: snapshot })
          .abortSignal(controller.signal);
        if (saveError) throw saveError;
        return data;
      });
      if (!owns()) return;
      if (!result) throw new Error('Profile completion could not be confirmed.');
      await onSaved();
    } catch (cause) {
      if (!owns()) return;
      const code = cause && typeof cause === 'object' && 'code' in cause ? String((cause as { code: unknown }).code) : '';
      setConflict(code === 'PT409');
      // A lost response may have committed: review before any repeat write.
      setUncertain(code !== 'PT409' && code !== '22023' && code !== '42501');
      setError(code === 'PT409' ? 'Your profile changed on another screen or device. Reload and review the current details before saving.'
        : code === '42501' ? 'This account cannot complete resident setup. Sign out and use the correct account.'
        : code === '22023' ? 'Check your details and registration locality, then try again.'
        : cause instanceof SetupTimeout ? cause.message
        : 'The save could not be confirmed. Reload and review your saved profile before saving again.');
    } finally { controller.abort(); if (owns()) setBusy(false); }
  }

  function leave(action: () => void) {
    if (authRequests.busy || profileRequests.busy) { setError('The earlier request is still finishing. Please wait before leaving this step.'); return; }
    action();
  }

  const showOccupation = employmentStatus !== '' && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus);
  return <Screen>
    <Body heading>Let&apos;s get you set up</Body>
    <Body tone="secondary">Fill in your details to register with your barangay. Fields marked * are required.</Body>
    {!ready && !loadFailed && <Body tone="secondary">Loading your details…</Body>}
    {ready && <>
      <Card><Body heading role="headline">Personal information</Body>
        <Field label="First name" required value={firstName} onChangeText={setFirstName} textContentType="givenName" editable={editable} error={live(firstName, fieldErrors.firstName, nameIssue)} />
        <Field label="Last name" required value={lastName} onChangeText={setLastName} textContentType="familyName" editable={editable} error={live(lastName, fieldErrors.lastName, nameIssue)} />
        <Field label="Middle name (optional)" value={middleName} onChangeText={setMiddleName} textContentType="middleName" editable={editable} error={live(middleName, fieldErrors.middleName, nameIssue)} />
        <Field label="Suffix (optional)" value={suffix} onChangeText={setSuffix} editable={editable} error={live(suffix, fieldErrors.suffix, nameIssue)} />
        <Selector label="Sex" required options={SEX_OPTIONS} selected={sex} onChange={setSex} disabled={!editable} error={fieldErrors.sex} />
        <View style={{ gap: space[2] }}>
          <Text style={[typeScale.subheadline, { color: colors.textPrimary, fontWeight: '600' }]}>Date of birth <Text style={{ color: colors.danger }}>*</Text></Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Date of birth, required" accessibilityValue={{ text: birthDate ? birthdayLabel(isoDate(birthDate)) : 'Not selected' }}
            accessibilityHint="Opens the date picker" accessibilityState={{ disabled: !editable }} disabled={!editable} onPress={() => setBirthdayOpen(true)}
            style={{ minHeight: layout.buttonMinHeight, justifyContent: 'center', paddingHorizontal: space[3], borderWidth: 1, borderColor: fieldErrors.birthDate ? colors.danger : colors.border, borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: colors.surface, opacity: editable ? 1 : 0.5 }}>
            <Text style={[typeScale.body, { color: birthDate ? colors.textPrimary : colors.textTertiary }]}>{birthDate ? birthdayLabel(isoDate(birthDate)) : 'Select your date of birth'}</Text>
          </Pressable>
          {!!fieldErrors.birthDate && <Notice tone="danger" message={fieldErrors.birthDate} />}
          <BirthdaySheet visible={birthdayOpen} value={birthDate ? isoDate(birthDate) : ''} onClose={() => setBirthdayOpen(false)}
            onApply={(iso) => { setBirthDate(parseIso(iso)); setBirthdayOpen(false); }} />
        </View>
      </Card>
      <Card><Body heading role="headline">Contact and address</Body>
        <Field label="Mobile number" required value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" textContentType="telephoneNumber" maxLength={11} placeholder="09171234567" editable={editable} error={live(mobileNumber, fieldErrors.mobileNumber, mobileIssue)} />
        <Field label="Email address" required value={email} editable={false} />
        <Field label="House or unit number" required value={houseNo} onChangeText={setHouseNo} textContentType="streetAddressLine1" editable={editable} error={live(houseNo, fieldErrors.houseNo)} />
        <Field label="Street" required value={street} onChangeText={setStreet} textContentType="streetAddressLine2" editable={editable} error={live(street, fieldErrors.street)} />
        <Field label="Barangay" value={locality?.name ?? ''} editable={false} />
        <Field label="City" value={locality?.city ?? ''} editable={false} />
        <Field label="Province" value={locality?.province ?? ''} editable={false} />
      </Card>
      <Card><Body heading role="headline">Employment</Body>
        <Selector label="Employment status" required options={EMPLOYMENT_OPTIONS} selected={employmentStatus} disabled={!editable} error={fieldErrors.employmentStatus}
          onChange={(next) => { setEmploymentStatus(next); if (!EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(next)) setOccupation(''); }} />
        {showOccupation && <Field label="Occupation (optional)" value={occupation} onChangeText={setOccupation} editable={editable} />}
      </Card>
      <LocationCheck locating={locating} onLocating={setLocating} editable={editable} boundary={locality?.boundary ?? null}
        gps={gps} onGps={setGps} />
      <HomePinCard boundary={locality?.boundary ?? null} home={home} onHome={setHome} areaName={locality?.name ?? 'your barangay'} disabled={!editable} />
    </>}
    {!!error && <Notice tone="danger" message={error} />}
    {loadFailed && <Notice tone="danger" message="Unable to load your current profile or registration locality. Check your connection and retry." />}
    {(!ready || conflict || uncertain) && <Action label="Reload and review current profile" secondary disabled={busy}
      onPress={() => {
        if (profileRequests.busy) { setError('The earlier save is still finishing. Please wait before reloading.'); return; }
        setError(''); setFieldErrors({}); setAttempt((value) => value + 1);
      }} />}
    <Action label={busy ? 'Saving…' : required ? 'Next' : 'Confirm personal details'} disabled={!ready || busy || conflict || uncertain} onPress={() => void save()} />
    {onReview && <Action label="Back" secondary disabled={busy} onPress={() => leave(onReview)} />}
    {!required && onSkip && <Action label="Skip for now" secondary disabled={busy} onPress={() => leave(onSkip)} />}
    <Action label="Sign out" secondary disabled={busy} onPress={() => leave(onSignOut)} />
    {required && <Card><EmergencyEntry /></Card>}
  </Screen>;
}

/**
 * Optional device-location check. Permission is requested only when the resident taps the action,
 * the fix is foreground only and kept in memory until the profile is saved, and nothing here
 * blocks setup: a manual home pin is placed later in Settings (Location verification).
 */
function LocationCheck({ locating, onLocating, editable, boundary, gps, onGps }: {
  locating: boolean; onLocating: (value: boolean) => void; editable: boolean;
  boundary: Polygon | MultiPolygon | null; gps: { lat: number; lng: number } | null; onGps: (point: { lat: number; lng: number }) => void;
}) {
  const location = useDeviceLocation(locating);
  const origin = location.state.origin;
  useEffect(() => {
    if (origin) onGps({ lat: origin.lat, lng: origin.lng });
  }, [origin, onGps]);
  const message = location.message;
  const inside = gps && boundary ? isPointInPolygon(gps, boundary) : null;
  return <Card><Body heading role="headline">Location check (optional)</Body>
    <Body tone="secondary">{gps
      ? inside === null ? 'Your device location was recorded.' : inside ? 'Your device location is inside the barangay boundary.' : 'Your device location is outside the barangay boundary. You can still continue; staff may review it.'
      : 'Record your device location now, or continue and verify your home location later in Settings.'}</Body>
    {locating && message && <Notice message={`${message.title}${message.detail ? ` ${message.detail}` : ''}`} tone={message.tone === 'error' ? 'danger' : 'primary'} />}
    {!locating || !message || message.actions.includes('locate') || message.actions.includes('retry')
      ? <Action label={gps ? 'Update my location' : 'Use my current location'} secondary disabled={!editable}
        onPress={() => { if (locating) location.locate(); else onLocating(true); }} />
      : null}
    {locating && message?.actions.includes('confirm') && <Action label="Use this location" disabled={!editable} onPress={location.confirm} />}
    {locating && message?.actions.includes('reject') && <Action label="Try again" secondary disabled={!editable} onPress={location.reject} />}
    {locating && message?.actions.includes('open-settings') && <Action label="Open Settings" secondary onPress={location.openSettings} />}
    {locating && message?.actions.includes('cancel') && <Action label="Cancel" secondary onPress={() => { location.cancel(); onLocating(false); }} />}
  </Card>;
}
