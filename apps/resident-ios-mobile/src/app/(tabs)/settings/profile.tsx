import { EMPLOYMENT_STATUSES, MOBILE_NUMBER_REGEX, NAME_REGEX, SEXES, type EmploymentStatus, type Sex } from '@barangayan/shared';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { z } from 'zod';
import { RequireResident } from '../../../components/require-resident';
import { Action, Body, Card, Field, Notice, Screen, Selector, useDiscardGuard } from '../../../components/ui';
import { residentError } from '../../../lib/errors';
import { useResident, type Profile } from '../../../lib/runtime';
import { layout, radius, space, typeScale, useColors } from '../../../lib/theme';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').regex(NAME_REGEX, 'First name must contain letters only'),
  middle_name: z.string().regex(NAME_REGEX, 'Middle name must contain letters only').nullable(),
  last_name: z.string().min(1, 'Last name is required').regex(NAME_REGEX, 'Last name must contain letters only'),
  suffix: z.string().regex(NAME_REGEX, 'Suffix must contain letters only').nullable(),
  mobile_number: z.string().regex(MOBILE_NUMBER_REGEX, 'Enter an 11-digit mobile number'),
  house_no: z.string().min(1, 'House or unit number is required'), street: z.string().min(1, 'Street is required'), city: z.string().nullable(),
  sex: z.enum(SEXES, { message: 'Select your sex' }), employment_status: z.enum(EMPLOYMENT_STATUSES, { message: 'Select your employment status' }), occupation: z.string().nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
type FieldName = keyof z.infer<typeof profileSchema>;

const employmentOptions = EMPLOYMENT_STATUSES.map((value) => ({ value, label: ({ employed: 'Employed', unemployed: 'Unemployed', student: 'Student', self_employed: 'Self-employed', retired: 'Retired' } satisfies Record<EmploymentStatus, string>)[value] }));
const toDate = (value: string | null) => {
  const matched = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return matched ? new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), 12) : new Date(2000, 0, 1, 12);
};
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const draftFrom = (profile: Profile) => ({
  first_name: profile.first_name ?? '', middle_name: profile.middle_name ?? '', last_name: profile.last_name ?? '', suffix: profile.suffix ?? '',
  mobile_number: profile.mobile_number ?? '', house_no: profile.house_no ?? '', street: profile.street ?? '', city: profile.city ?? '',
  sex: (profile.sex ?? '') as Sex | '', employment_status: (profile.employment_status ?? '') as EmploymentStatus | '', occupation: profile.occupation ?? '',
  birth_date: isoDate(toDate(profile.birth_date)),
});
function Choices<T extends string>({ label, values, selected, display, onChange, error }: { label: string; values: readonly T[]; selected: T | ''; display: (value: T) => string; onChange: (value: T) => void; error?: string }) {
  const colors = useColors();
  return <View accessibilityRole="radiogroup" accessibilityLabel={`${label}, required`} style={{ gap: space[2] }}><Body role="subheadline">{label} *</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>{values.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: selected === value }} onPress={() => onChange(value)} style={{ minHeight: layout.controlMin, justifyContent: 'center', paddingHorizontal: space[4], borderRadius: radius.xl, borderWidth: 1, borderColor: selected === value ? colors.primary : colors.border, backgroundColor: selected === value ? colors.surfaceSelected : 'transparent' }}><Text style={[typeScale.callout, { color: colors.textPrimary }]}>{display(value)}</Text></Pressable>)}</View>{!!error && <Body role="footnote" tone="danger">{error}</Body>}</View>;
}

export default function ProfileRoute() {
  return <RequireResident purpose="edit your profile"><ProfileScreen /></RequireResident>;
}
function ProfileScreen() {
  const { client, session, profile, refreshProfile } = useResident();
  const [draft, setDraft] = useState(() => profile ? draftFrom(profile) : null);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const dirty = !!profile && !!draft && JSON.stringify(draft) !== JSON.stringify(draftFrom(profile));
  useDiscardGuard(dirty && !busy);
  if (!session || !profile || !draft) return null;
  const resident = profile;
  const userId = session.user.id;
  const set = (key: Exclude<FieldName, 'sex' | 'employment_status'>) => (value: string) => setDraft((current) => current && { ...current, [key]: value });
  async function save() {
    if (busy || !draft) return;
    const parsed = profileSchema.safeParse({
      ...draft, middle_name: draft.middle_name.trim() || null, suffix: draft.suffix.trim() || null, city: draft.city.trim() || null,
      occupation: draft.occupation.trim() || null, sex: draft.sex || undefined, employment_status: draft.employment_status || undefined,
    });
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fieldErrors).map(([key, values]) => [key, values?.[0]])));
      setMessage('Check the highlighted fields.');
      return;
    }
    setBusy(true); setMessage(''); setErrors({});
    try {
      const { error } = await client.from('profiles').update(parsed.data).eq('id', userId).eq('barangay_id', resident.barangay_id);
      if (error) throw error;
      await refreshProfile(); setMessage('Profile saved.');
    } catch (failure) { setMessage(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><Body tone="secondary">Household and ID verification changes remain unavailable until their authorization checks pass.</Body>
    <Card><Body heading>Personal information</Body><Field label="First name" required error={errors.first_name} value={draft.first_name} onChangeText={set('first_name')} textContentType="givenName" /><Field label="Middle name (optional)" error={errors.middle_name} value={draft.middle_name} onChangeText={set('middle_name')} textContentType="middleName" /><Field label="Last name" required error={errors.last_name} value={draft.last_name} onChangeText={set('last_name')} textContentType="familyName" /><Field label="Suffix (optional)" error={errors.suffix} value={draft.suffix} onChangeText={set('suffix')} textContentType="nameSuffix" />
      <Choices label="Sex" values={SEXES} selected={draft.sex} error={errors.sex} display={(value) => value === 'male' ? 'Male' : 'Female'} onChange={(value) => setDraft((current) => current && { ...current, sex: value })} />
      <Body role="subheadline">Date of birth *</Body><DateTimePicker value={toDate(draft.birth_date)} onValueChange={(_, value) => setDraft((current) => current && { ...current, birth_date: isoDate(value) })} mode="date" display="compact" maximumDate={new Date()} disabled={busy} />
      <Body tone="secondary">Sign-in email: {resident.email ?? session.user.email ?? ''}</Body><Body tone="secondary">Email changes require barangay support so verification remains protected.</Body>
      <Field label="Mobile number" required error={errors.mobile_number} placeholder="09XXXXXXXXX" value={draft.mobile_number} onChangeText={set('mobile_number')} keyboardType="phone-pad" textContentType="telephoneNumber" maxLength={11} /></Card>
    <Card><Body heading>Address</Body><Field label="House or unit number" required error={errors.house_no} value={draft.house_no} onChangeText={set('house_no')} /><Field label="Street" required error={errors.street} value={draft.street} onChangeText={set('street')} textContentType="streetAddressLine1" /><Field label="City or municipality (optional)" error={errors.city} value={draft.city} onChangeText={set('city')} textContentType="addressCity" /></Card>
    <Card><Body heading>Employment</Body><Selector label="Employment status" required options={employmentOptions} selected={draft.employment_status} error={errors.employment_status} disabled={busy} onChange={(value) => setDraft((current) => current && { ...current, employment_status: value })} /><Field label="Occupation (optional)" error={errors.occupation} value={draft.occupation} onChangeText={set('occupation')} textContentType="jobTitle" /></Card>
    {!!message && <Notice message={message} />}<Action label={busy ? 'Saving…' : 'Save changes'} disabled={busy || !dirty} onPress={() => void save()} />
  </Screen>;
}
