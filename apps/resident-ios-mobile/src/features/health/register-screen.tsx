import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Action, Body, Card, Destination, EmptyState, Field, Notice, ResourceState, Screen, Segmented, SymbolIcon, Toggle, Unavailable, useDiscardGuard } from '../../components/ui';
import { DataError } from '../../data/outcome';
import type { DriveItem, DriveRegistrationOutcome } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { residentError } from '../../lib/errors';
import { releaseGates } from '../../lib/release-gates';
import { useResident, type Profile } from '../../lib/runtime';
import { layout, space, useColors, useType } from '../../lib/theme';
import { BirthdaySheet } from '../profile/birthday-sheet';
import { birthdayLabel } from '../profile/birthday';
import { initials } from '../profile/profile-form';
import { AvailabilityBadge, CategoryLabel, StockBar } from './drive-card';
import { AVAILABILITY_LABEL, driveAvailability, formatDriveDate, formatTimeRange, manilaToday } from './drive-model';
import {
  ageFromBirthDate, CONDITIONS, DOSES, NO_CONDITIONS, toggleCondition, validateRegistration, type Condition, type ConditionState, type Dose, type RegistrationErrors,
} from './registration-form';
import { STATUS_PRESENTATION, statusByDrive } from './registration-model';
import { useDrive, useRegistrationSummary } from './use-health-data';

const PRIVACY_COPY = "These answers are used only to decide how slots for this drive are given out, and are handled under the barangay's Data Privacy Policy. The app keeps them in memory only until you submit or leave this screen.";

function CheckRow({ label, checked, disabled, onPress }: { label: string; checked: boolean; disabled: boolean; onPress: () => void }) {
  const colors = useColors();
  const type = useType();
  return <Pressable accessibilityRole="checkbox" accessibilityLabel={label} accessibilityState={{ checked, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: layout.controlMin, flexDirection: 'row', alignItems: 'center', gap: space[3], opacity: disabled ? 0.5 : pressed ? 0.7 : 1 })}>
    <SymbolIcon name={checked ? 'checkmark.square.fill' : 'square'} color={checked ? colors.primary : colors.textSecondary} size={22} />
    <Text style={[type.body, { color: colors.textPrimary, flex: 1 }]}>{label}</Text>
  </Pressable>;
}

function Applicant({ profile, profileAge, ageText, onAgeText, ageError, disabled }: { profile: Profile; profileAge: number | null; ageText: string; onAgeText: (value: string) => void; ageError?: string; disabled: boolean }) {
  const colors = useColors();
  const type = useType();
  const [photoFailed, setPhotoFailed] = useState(false);
  return <Card>
    <Body heading role="headline">Registering for</Body>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View accessible accessibilityRole="image" accessibilityLabel={profile.avatar_url && !photoFailed ? 'Your profile photo' : `No profile photo, initials ${initials(profile)}`}
        style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: colors.surfaceSelected, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border }}>
        {profile.avatar_url && !photoFailed
          ? <Image source={{ uri: profile.avatar_url }} style={{ width: 56, height: 56 }} onError={() => setPhotoFailed(true)} accessibilityIgnoresInvertColors />
          : <Text style={[type.title2, { color: colors.primary }]}>{initials(profile)}</Text>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[type.headline, { color: colors.textPrimary }]}>{profile.full_name}</Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]}>You</Text>
      </View>
    </View>
    {profileAge !== null
      ? <View accessible accessibilityLabel={`Age: ${profileAge}, from your date of birth`} style={{ gap: 2 }}><Body role="footnote" tone="secondary">Age (from your date of birth)</Body><Body>{profileAge}</Body></View>
      : <>
        <Field label="Age in years" required value={ageText} onChangeText={(value) => onAgeText(value.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" maxLength={3} editable={!disabled} error={ageError} />
        <Body role="footnote" tone="secondary">Your profile has no usable date of birth. Add it in your profile to fill the age in automatically.</Body>
      </>}
    <View accessible accessibilityLabel={`Address: ${profile.home_address || 'not on file'}`} style={{ gap: 2 }}><Body role="footnote" tone="secondary">Address</Body><Body>{profile.home_address || 'No address on file'}</Body></View>
    <Destination title="Edit in Profile" detail="Your changes appear here when you return" href="/settings/profile" />
    <Body role="footnote" tone="secondary">Registration is for you only. Family members cannot be registered from the app.</Body>
  </Card>;
}

/**
 * Full-screen self-registration (A30). The answers live only in memory. The server decides resident role, tenant, an active
 * and open drive, capacity and duplicates and returns the applicant number; this screen shows that number only once it has it.
 */
export function RegisterScreen({ id }: { id: unknown }) {
  const resource = useDrive(id);
  const drive = resource.data;
  return <Screen>
    <ResourceState loading={resource.loading && drive === undefined} error={drive === undefined ? resource.error : undefined} retry={() => void resource.refresh()} />
    {drive === null && <EmptyState title="Drive unavailable" message="This medical drive is no longer listed, so it cannot be registered for."><Destination title="Back to Health" href="/health" /></EmptyState>}
    {drive && <RegistrationForm drive={drive} reloadDrive={() => void resource.refresh()} />}
  </Screen>;
}

function RegistrationForm({ drive, reloadDrive }: { drive: DriveItem; reloadDrive: () => void }) {
  const router = useRouter();
  const api = useApi();
  const { profile } = useResident();
  const summary = useRegistrationSummary();
  const today = manilaToday();
  const profileAge = useMemo(() => ageFromBirthDate(profile?.birth_date, today), [profile?.birth_date, today]);
  const [ageText, setAgeText] = useState('');
  const [isPwd, setIsPwd] = useState(false);
  const [conditions, setConditions] = useState<ConditionState>(NO_CONDITIONS);
  const [dose, setDose] = useState<Dose>('first');
  const [priorDoseDate, setPriorDoseDate] = useState<string | null>(null);
  const [pickingDate, setPickingDate] = useState(false);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<RegistrationErrors>({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<{ message: string; checkRegistrations: boolean } | null>(null);
  const [outcome, setOutcome] = useState<DriveRegistrationOutcome | null>(null);
  const sending = useRef(false);
  const dirty = !outcome && (ageText !== '' || isPwd || conditions.none || conditions.conditions.length > 0 || dose !== 'first' || consent);
  useDiscardGuard(dirty);

  if (!releaseGates.medicalRegistration) return <Unavailable service="Registering for a medical drive in the app" />;
  const existing = statusByDrive(summary.data ?? []).get(drive.id) ?? null;
  const availability = driveAvailability(drive, today);
  const blocked = existing !== null || availability !== 'open';

  async function submit() {
    if (sending.current || outcome || !profile) return;
    const checked = validateRegistration(drive.id, { profileAge, ageText, isPwd, conditions, dose, priorDoseDate, consent, today });
    if ('errors' in checked) { setErrors(checked.errors); setFailure(null); return; }
    sending.current = true;
    setErrors({});
    setFailure(null);
    setBusy(true);
    try {
      setOutcome(await api.registerForDrive(checked.payload));
    } catch (error) {
      setFailure({ message: residentError(error), checkRegistrations: error instanceof DataError && (error.code === 'P0004' || error.kind === 'unknown-commit') });
      reloadDrive();
      void summary.refresh();
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  if (outcome) {
    const status = STATUS_PRESENTATION[outcome.status];
    return <>
      <Card>
        <Body heading>Registration received</Body>
        <Body>{outcome.reconciled ? "The barangay's reply did not reach your phone, but your registration was saved." : `The barangay received your registration for ${drive.title}.`}</Body>
        <View accessible accessibilityLabel={`Applicant number: ${outcome.applicant_number}`} style={{ gap: 2 }}><Body role="footnote" tone="secondary">Applicant number</Body><Body role="monoReference">{outcome.applicant_number}</Body></View>
        <Body>Status: {status.label}. {status.meaning}</Body>
        <Body tone="secondary">{formatDriveDate(drive.drive_date)}, {formatTimeRange(drive)} at {drive.location}.</Body>
      </Card>
      <Destination title="View my registrations" href={{ pathname: '/health', params: { segment: 'registrations' } }} />
      <Action label="Back to the drive" secondary onPress={() => router.dismissTo({ pathname: '/health/[id]', params: { id: drive.id } })} />
    </>;
  }

  if (!profile) return <EmptyState title="Finish your profile first" message="Your profile is not complete yet, so a registration cannot be made."><Destination title="Open Profile" href="/settings/profile" /></EmptyState>;

  return <>
    <Card>
      <CategoryLabel typeName={drive.type} />
      <Body heading role="headline">{drive.title}</Body>
      <Body tone="secondary">{formatDriveDate(drive.drive_date)} · {formatTimeRange(drive)}</Body>
      <Body tone="secondary">{drive.location}</Body>
      <StockBar drive={drive} />
      <AvailabilityBadge drive={drive} today={today} registration={existing} />
    </Card>
    {existing !== null && <Notice message="You already have a registration for this drive, so you cannot register again." />}
    {existing === null && availability !== 'open' && <Notice tone="danger" message={availability === 'closed' ? 'This drive has already taken place, so registration is closed.' : 'This drive has no slots left.'} />}
    <Applicant profile={profile} profileAge={profileAge} ageText={ageText} onAgeText={setAgeText} ageError={errors.age} disabled={busy || blocked} />
    <Card>
      <Body heading role="headline">Eligibility information</Body>
      <Toggle label="Person with disability (PWD)" value={isPwd} onChange={setIsPwd} disabled={busy || blocked} />
      <View style={{ gap: space[1] }}>
        <Body role="subheadline" tone="secondary">Conditions (select all that apply)</Body>
        {CONDITIONS.map((condition: Condition) => <CheckRow key={condition} label={condition} checked={conditions.conditions.includes(condition)} disabled={busy || blocked} onPress={() => setConditions(toggleCondition(conditions, condition))} />)}
        <CheckRow label="None" checked={conditions.none} disabled={busy || blocked} onPress={() => setConditions(toggleCondition(conditions, 'None'))} />
        <Body role="footnote" tone="secondary">Choosing None clears the conditions above, and choosing a condition clears None.</Body>
      </View>
      <Body role="subheadline" tone="secondary">Dose history</Body>
      <Segmented<Dose> label="Dose history" options={DOSES} selected={dose} onChange={(next) => { setDose(next); setErrors((current) => ({ ...current, priorDose: undefined })); }} />
      {dose !== 'first' && <View style={{ gap: space[2] }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Date of previous dose, required. ${priorDoseDate ? birthdayLabel(priorDoseDate) : 'Not chosen'}`} accessibilityHint="Opens the date chooser" disabled={busy || blocked} onPress={() => setPickingDate(true)}
          style={({ pressed }) => ({ minHeight: layout.buttonMinHeight, justifyContent: 'center', paddingHorizontal: space[3], opacity: busy || blocked ? 0.5 : pressed ? 0.7 : 1 })}>
          <PriorDoseRow date={priorDoseDate} error={errors.priorDose} />
        </Pressable>
        {!!errors.priorDose && <Notice tone="danger" message={errors.priorDose} />}
        <BirthdaySheet visible={pickingDate} value={priorDoseDate ?? today} title="Previous dose date" onApply={(iso) => { setPriorDoseDate(iso); setErrors((current) => ({ ...current, priorDose: undefined })); setPickingDate(false); }} onClose={() => setPickingDate(false)} />
      </View>}
      {dose === 'first' && <Body role="footnote" tone="secondary">A 1st dose sends no previous-dose date.</Body>}
    </Card>
    <Card>
      <Body heading role="headline">Privacy and consent</Body>
      <Body tone="secondary">{PRIVACY_COPY}</Body>
      <CheckRow label="I understand and consent to this use of my health answers" checked={consent} disabled={busy || blocked} onPress={() => { setConsent(!consent); setErrors((current) => ({ ...current, consent: undefined })); }} />
      {!!errors.consent && <Notice tone="danger" message={errors.consent} />}
    </Card>
    {failure && <Card>
      <Notice tone="danger" message={failure.message} />
      {failure.checkRegistrations && <Destination title="Check my registrations" href={{ pathname: '/health', params: { segment: 'registrations' } }} />}
    </Card>}
    <Action label={busy ? 'Sending registration…' : blocked ? (existing ? 'Already registered' : AVAILABILITY_LABEL[availability]) : 'Submit registration'} disabled={busy || blocked} onPress={() => void submit()} />
  </>;
}

function PriorDoseRow({ date, error }: { date: string | null; error?: string }) {
  const colors = useColors();
  const type = useType();
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
    <View style={{ flex: 1 }}>
      <Text style={[type.footnote, { color: colors.textSecondary }]}>Date of previous dose *</Text>
      <Text style={[type.body, { color: date ? colors.textPrimary : error ? colors.danger : colors.textTertiary }]}>{date ? birthdayLabel(date) : 'Choose the date'}</Text>
    </View>
    <SymbolIcon name="calendar" color={colors.primary} size={18} />
  </View>;
}
