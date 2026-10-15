import { EMPLOYMENT_STATUSES, SEXES, type EmploymentStatus } from '@barangayan/shared';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { profileRequests, SetupTimeout } from '../../auth/request-gate';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Destination, EmptyState, Field, Loading, Notice, Screen, Selector, StatusBadge, useDiscardGuard } from '../../components/ui';
import { toDataError } from '../../data/outcome';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { residentError } from '../../lib/errors';
import { useResident, type Profile } from '../../lib/runtime';
import { layout, radius, space, typeScale, useColors } from '../../lib/theme';
import { AvatarCard } from './avatar-card';
import { birthdayLabel } from './birthday';
import { BirthdaySheet } from './birthday-sheet';
import { HouseholdCard } from './household-card';
import { draftFrom, fieldIssue, reconcileConflict, sameDraft, usesOccupation, validateDraft, withEmploymentStatus, type DraftErrors, type DraftField, type ProfileDraft } from './profile-form';
import { saveProfile } from './profile-save';

const SEX_OPTIONS = SEXES.map((value) => ({ value, label: value === 'male' ? 'Male' : 'Female' }));
const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = { employed: 'Employed', unemployed: 'Unemployed', student: 'Student', self_employed: 'Self-employed', retired: 'Retired' };
const EMPLOYMENT_OPTIONS = EMPLOYMENT_STATUSES.map((value) => ({ value, label: EMPLOYMENT_LABELS[value] }));

export function ProfileRoute() {
  return <RequireResident purpose="view and edit your profile"><ProfileLoader /></RequireResident>;
}

function ProfileLoader() {
  const { session, profile } = useResident();
  if (!session) return null;
  if (!profile) {
    // No committed profile yet: the setup flow owns creating it.
    return <Screen><EmptyState title="Finish your details first" message="Your profile is created when you complete your resident details.">
      <Destination title="Complete your details" href="/complete-profile" />
    </EmptyState></Screen>;
  }
  return <ProfileScreen key={profile.id} profile={profile} />;
}

type Result = { text: string; tone: 'primary' | 'danger' };

function ProfileScreen({ profile }: { profile: Profile }) {
  const { client, refreshProfile } = useResident();
  const api = useApi();
  const colors = useColors();
  const context = useResource('barangay-profile', (signal) => api.barangayProfile(signal));
  const locality = context.data?.locality ?? null;
  // Until the locality is known the city is treated as server-owned, so it is never written by mistake.
  const cityLocked = context.data ? !!locality : true;

  const [base, setBase] = useState<Profile>(profile);
  const [draft, setDraft] = useState<ProfileDraft>(() => draftFrom(profile));
  const [seen, setSeen] = useState<Profile>(profile);
  const [outdated, setOutdated] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [birthdayOpen, setBirthdayOpen] = useState(false);

  const dirty = !sameDraft(draft, draftFrom(base));
  // A refreshed row replaces the form when nothing is staged, is absorbed when only unrelated
  // columns changed, and otherwise marks the form outdated instead of overwriting the edits.
  if (seen !== profile) {
    setSeen(profile);
    if (!dirty || sameDraft(draftFrom(profile), draft)) { setBase(profile); setDraft(draftFrom(profile)); setOutdated(false); }
    else if (reconcileConflict(base, profile) === 'retry') setBase(profile);
    else setOutdated(true);
  }
  useDiscardGuard(dirty && !busy);

  const set = (field: DraftField) => (value: string) => { setDraft((current) => ({ ...current, [field]: value })); setResult(null); };
  const issue = (field: DraftField) => errors[field] ?? fieldIssue(field, draft[field]);
  const view = { editable: !busy && !outdated };

  async function showLatest() {
    if (busy) return;
    setBusy(true);
    try {
      const { data: latest, error } = await client.from('profiles').select('*').eq('id', profile.id).maybeSingle();
      if (error || !latest) throw error ?? new Error('Profile unavailable');
      setBase(latest); setDraft(draftFrom(latest)); setOutdated(false); setErrors({});
      setResult({ text: 'Showing your latest saved details.', tone: 'primary' });
      await refreshProfile().catch(() => undefined);
    } catch (failure) { setResult({ text: residentError(failure), tone: 'danger' }); }
    finally { setBusy(false); }
  }

  async function save() {
    if (busy || !dirty || outdated) return;
    const checked = validateDraft(draft, { cityLocked });
    if (!checked.ok) { setErrors(checked.errors); setResult({ text: 'Check the highlighted fields.', tone: 'danger' }); return; }
    setErrors({}); setBusy(true); setResult(null);
    try {
      const outcome = await saveProfile(client, base, checked.patch, (work) => profileRequests.run(work));
      if (outcome.kind === 'review') {
        setOutdated(true);
        setResult({ text: 'Your details were changed on another device, so nothing was saved. Show the latest details, then make your changes again.', tone: 'danger' });
      } else if (outcome.kind === 'changed-again') {
        setResult({ text: 'Your profile changed while saving, so nothing was saved. Try again.', tone: 'danger' });
      } else {
        const emailChanged = checked.patch.email !== (outcome.base.email ?? '');
        await refreshProfile().catch(() => undefined);
        setResult({ text: emailChanged ? 'Profile saved. Your profile email changed, so it must be verified again.' : 'Profile saved.', tone: 'primary' });
      }
    } catch (failure) {
      // A write whose reply was lost may have committed; the server row is reloaded so the form shows the truth.
      void refreshProfile().catch(() => undefined);
      setResult({ text: failure instanceof SetupTimeout ? failure.message : residentError(toDataError(failure, { write: true })), tone: 'danger' });
    } finally { setBusy(false); }
  }

  const verified = profile.email_verification_status === 'verified';
  const locationSaved = !!profile.verified_location;
  return <Screen>
    <AvatarCard profile={profile} />
    {outdated && <Card><Notice tone="danger" message="These details changed on another device. Your edits are kept below, but they cannot be saved over the newer details." />
      <Action label="Show latest details" disabled={busy} onPress={() => void showLatest()} /></Card>}
    <Card><Body heading>Personal information</Body>
      <Field label="First name" required value={draft.firstName} onChangeText={set('firstName')} textContentType="givenName" editable={view.editable} error={issue('firstName')} />
      <Field label="Middle name (optional)" value={draft.middleName} onChangeText={set('middleName')} textContentType="middleName" editable={view.editable} error={issue('middleName')} />
      <Field label="Last name" required value={draft.lastName} onChangeText={set('lastName')} textContentType="familyName" editable={view.editable} error={issue('lastName')} />
      <Field label="Suffix (optional)" value={draft.suffix} onChangeText={set('suffix')} textContentType="nameSuffix" editable={view.editable} error={issue('suffix')} />
      <Selector label="Sex" required options={SEX_OPTIONS} selected={draft.sex} disabled={!view.editable} error={errors.sex}
        onChange={(sex) => { setDraft((current) => ({ ...current, sex })); setResult(null); }} />
      <View style={{ gap: space[2] }}>
        <Text accessibilityElementsHidden style={[typeScale.subheadline, { color: colors.textPrimary, fontWeight: '600' }]}>Date of birth <Text style={{ color: colors.danger }}>*</Text></Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Date of birth, required" accessibilityValue={{ text: birthdayLabel(draft.birthDate) || 'Not selected' }} accessibilityHint="Opens the date picker"
          accessibilityState={{ disabled: !view.editable }} disabled={!view.editable} onPress={() => setBirthdayOpen(true)}
          style={{ minHeight: layout.buttonMinHeight, justifyContent: 'center', paddingHorizontal: space[3], borderWidth: 1, borderColor: errors.birthDate ? colors.danger : colors.border, borderRadius: radius.sm, borderCurve: 'continuous', backgroundColor: colors.surface, opacity: view.editable ? 1 : 0.5 }}>
          <Text style={[typeScale.body, { color: draft.birthDate ? colors.textPrimary : colors.textTertiary }]}>{birthdayLabel(draft.birthDate) || 'Select date of birth'}</Text>
        </Pressable>
        {!!issue('birthDate') && <Notice tone="danger" message={issue('birthDate') as string} />}
      </View>
      <Field label="Mobile number" required value={draft.mobileNumber} onChangeText={(value) => set('mobileNumber')(value.replace(/\D/g, ''))} keyboardType="phone-pad" textContentType="telephoneNumber" maxLength={11} placeholder="09171234567" editable={view.editable} error={issue('mobileNumber')} />
      <Field label="Email address" required value={draft.email} onChangeText={set('email')} keyboardType="email-address" autoCapitalize="none" textContentType="emailAddress" editable={view.editable} error={issue('email')} />
      <Body role="footnote" tone="secondary">This is the email on your resident profile. It does not change the email you sign in with. A changed profile email must be verified again.</Body>
    </Card>
    <Card><Body heading>Address</Body>
      <Field label="House or unit number" required value={draft.houseNo} onChangeText={set('houseNo')} textContentType="streetAddressLine1" editable={view.editable} error={issue('houseNo')} />
      <Field label="Street" required value={draft.street} onChangeText={set('street')} textContentType="streetAddressLine2" editable={view.editable} error={issue('street')} />
      {cityLocked
        ? <Field label="City or municipality" value={locality?.city ?? profile.city ?? ''} editable={false} accessibilityHint="Set by your barangay and cannot be changed here" />
        : <Field label="City or municipality" required value={draft.city} onChangeText={set('city')} textContentType="addressCity" editable={view.editable} error={issue('city')} />}
      <Field label="Barangay" value={locality?.display_name ?? context.data?.name ?? ''} editable={false} accessibilityHint="Assigned when you registered and cannot be changed here" />
      <Field label="Province" value={locality?.province ?? ''} editable={false} accessibilityHint="Set by your barangay and cannot be changed here" />
      {context.loading && !context.data && <Loading label="Loading your barangay details…" />}
      {context.error && !context.data && <>
        <Notice tone="danger" message="Your barangay details could not be loaded, so the city stays locked until they load." />
        <Action label="Try again" secondary onPress={() => void context.refresh()} />
      </>}
    </Card>
    <Card><Body heading>Employment</Body>
      <Selector label="Employment status" required options={EMPLOYMENT_OPTIONS} selected={draft.employmentStatus} disabled={!view.editable} error={errors.employmentStatus}
        onChange={(status) => { setDraft((current) => withEmploymentStatus(current, status)); setResult(null); }} />
      {usesOccupation(draft.employmentStatus) && <Field label="Occupation (optional)" value={draft.occupation} onChangeText={set('occupation')} textContentType="jobTitle" editable={view.editable} error={issue('occupation')} />}
    </Card>
    {result && <Notice message={result.text} tone={result.tone} />}
    {dirty && !busy && <Body role="footnote" tone="secondary">You have unsaved changes.</Body>}
    <Action label={busy ? 'Saving…' : 'Save changes'} disabled={busy || !dirty || outdated} onPress={() => void save()} />
    <HouseholdCard profile={profile} />
    <Card><Body heading>Verification</Body>
      <StatusBadge label={verified ? 'Email verified' : 'Email not verified'} icon={verified ? 'checkmark.circle' : 'exclamationmark.triangle'} tone={verified ? 'success' : 'warning'} />
      <Destination title="Email verification" href="/settings/email-verification" />
      <Destination title="ID verification" detail="Choose your ID type and submit the front and back" href="/settings/id-verification" />
      <Destination title="Location verification" detail={locationSaved ? 'A home location is saved' : 'No home location saved yet'} href="/settings/location-verification" />
    </Card>
    <BirthdaySheet visible={birthdayOpen} value={draft.birthDate} onClose={() => setBirthdayOpen(false)}
      onApply={(iso) => { setDraft((current) => ({ ...current, birthDate: iso })); setErrors((current) => ({ ...current, birthDate: undefined })); setResult(null); setBirthdayOpen(false); }} />
  </Screen>;
}
