import { EMPLOYMENT_STATUSES, MOBILE_NUMBER_REGEX, NAME_REGEX, SEXES, type EmploymentStatus, type Sex } from '@barangayan/shared';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { z } from 'zod';
import { Action, Body, Card, Field, Notice, Screen, usePalette } from '../components/ui';
import { residentError } from '../lib/errors';
import { useResident } from '../lib/runtime';

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').regex(NAME_REGEX, 'First name must contain letters only'),
  middle_name: z.string().regex(NAME_REGEX, 'Middle name must contain letters only').nullable(),
  last_name: z.string().min(1, 'Last name is required').regex(NAME_REGEX, 'Last name must contain letters only'),
  suffix: z.string().regex(NAME_REGEX, 'Suffix must contain letters only').nullable(),
  mobile_number: z.string().regex(MOBILE_NUMBER_REGEX, 'Enter an 11-digit mobile number'),
  house_no: z.string().min(1, 'House or unit number is required'), street: z.string().min(1, 'Street is required'), city: z.string().nullable(),
  sex: z.enum(SEXES), employment_status: z.enum(EMPLOYMENT_STATUSES), occupation: z.string().nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const employmentLabels: Record<EmploymentStatus, string> = { employed: 'Employed', unemployed: 'Unemployed', student: 'Student', self_employed: 'Self-employed', retired: 'Retired' };
const toDate = (value: string | null) => {
  const matched = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return matched ? new Date(Number(matched[1]), Number(matched[2]) - 1, Number(matched[3]), 12) : new Date(2000, 0, 1, 12);
};
const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function Choices<T extends string>({ label, values, selected, display, onChange }: { label: string; values: readonly T[]; selected: T | ''; display: (value: T) => string; onChange: (value: T) => void }) {
  const palette = usePalette();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}><Body>{label}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{values.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: selected === value }} onPress={() => onChange(value)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: selected === value ? palette.accent : palette.line }}><Text style={{ color: palette.text, fontSize: 16 }}>{display(value)}</Text></Pressable>)}</View></View>;
}

export default function ProfileScreen() {
  const { client, session, profile, refreshProfile } = useResident();
  const [draft, setDraft] = useState(() => ({
    first_name: profile?.first_name ?? '', middle_name: profile?.middle_name ?? '', last_name: profile?.last_name ?? '', suffix: profile?.suffix ?? '',
    email: profile?.email ?? session?.user.email ?? '', mobile_number: profile?.mobile_number ?? '', house_no: profile?.house_no ?? '', street: profile?.street ?? '', city: profile?.city ?? '',
    sex: (profile?.sex ?? '') as Sex | '', employment_status: (profile?.employment_status ?? '') as EmploymentStatus | '', occupation: profile?.occupation ?? '',
  }));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [birthDate, setBirthDate] = useState(() => toDate(profile?.birth_date ?? null));
  if (!session || !profile) return <Redirect href="/auth" />;
  const set = (key: keyof typeof draft) => (value: string) => setDraft((current) => ({ ...current, [key]: value }));
  async function save() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      const input = profileSchema.parse({
        ...draft, middle_name: draft.middle_name.trim() || null, suffix: draft.suffix.trim() || null, city: draft.city.trim() || null,
        occupation: draft.occupation.trim() || null, sex: draft.sex || undefined, employment_status: draft.employment_status || undefined, birth_date: isoDate(birthDate),
      });
      const resident = profile;
      const activeSession = session;
      if (!resident || !activeSession) throw new Error('Session unavailable');
      const { error } = await client.from('profiles').update(input).eq('id', activeSession.user.id).eq('barangay_id', resident.barangay_id);
      if (error) throw error;
      await refreshProfile(); setMessage('Profile saved.');
    } catch (failure) { setMessage(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><Body heading>My profile</Body><Body>Household and ID verification changes remain unavailable until their authorization checks pass.</Body>
    <Card><Body heading>Personal information</Body><Field label="First name" value={draft.first_name} onChangeText={set('first_name')} /><Field label="Middle name (optional)" value={draft.middle_name} onChangeText={set('middle_name')} /><Field label="Last name" value={draft.last_name} onChangeText={set('last_name')} /><Field label="Suffix (optional)" value={draft.suffix} onChangeText={set('suffix')} /><Choices label="Sex" values={SEXES} selected={draft.sex} display={(value) => value === 'male' ? 'Male' : 'Female'} onChange={(value) => setDraft((current) => ({ ...current, sex: value }))} /><Body>Date of birth</Body><DateTimePicker value={birthDate} onValueChange={(_, value) => setBirthDate(value)} mode="date" display="compact" maximumDate={new Date()} disabled={busy} /><Body>Sign-in email: {draft.email}</Body><Body>Email changes require barangay support so verification remains protected.</Body><Field label="Mobile number" value={draft.mobile_number} onChangeText={set('mobile_number')} keyboardType="phone-pad" maxLength={11} /></Card>
    <Card><Body heading>Address</Body><Field label="House or unit number" value={draft.house_no} onChangeText={set('house_no')} /><Field label="Street" value={draft.street} onChangeText={set('street')} /><Field label="City or municipality (optional)" value={draft.city} onChangeText={set('city')} /></Card>
    <Card><Body heading>Employment</Body><Choices label="Employment status" values={EMPLOYMENT_STATUSES} selected={draft.employment_status} display={(value) => employmentLabels[value]} onChange={(value) => setDraft((current) => ({ ...current, employment_status: value }))} /><Field label="Occupation (optional)" value={draft.occupation} onChangeText={set('occupation')} /></Card>
    {!!message && <Notice message={message} />}<Action label={busy ? 'Saving…' : 'Save changes'} disabled={busy} onPress={() => void save()} />
  </Screen>;
}
