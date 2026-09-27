import {
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_STATUSES_WITH_OCCUPATION,
  registerSchema,
  type EmploymentStatus,
  type Sex,
} from '@barangayan/shared';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Action, Body, Card, Field, Notice, Screen, usePalette } from '../../components/ui';
import { PublicError, residentError } from '../../lib/errors';
import { useResident } from '../../lib/runtime';

const employmentLabels: Record<EmploymentStatus, string> = {
  employed: 'Employed', unemployed: 'Unemployed', student: 'Student', self_employed: 'Self-employed', retired: 'Retired',
};

function isoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function Choices<T extends string>({ label, values, selected, display, onChange }: {
  label: string; values: readonly T[]; selected: T | null; display: (value: T) => string; onChange: (value: T) => void;
}) {
  const palette = usePalette();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ gap: 8 }}><Body>{label}</Body><View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
    {values.map((value) => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: selected === value }} onPress={() => onChange(value)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 22, borderWidth: 1, borderColor: selected === value ? palette.accent : palette.line, backgroundColor: selected === value ? palette.surface : 'transparent' }}><Text style={{ color: palette.text, fontSize: 16 }}>{display(value)}</Text></Pressable>)}
  </View></View>;
}

export default function RegisterScreen() {
  const { client, config, session, logout } = useResident();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');
  const [sex, setSex] = useState<Sex | null>(null);
  const [mobileNumber, setMobileNumber] = useState('');
  const [email, setEmail] = useState('');
  const [houseNo, setHouseNo] = useState('');
  const [street, setStreet] = useState('');
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus | null>(null);
  const [occupation, setOccupation] = useState('');
  const [birthDate, setBirthDate] = useState(new Date(2000, 0, 1, 12));
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (session) return <Redirect href="/(tabs)/home" />;

  async function submit() {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const input = registerSchema.parse({
        firstName: firstName.trim(), middleName: middleName.trim() || undefined, lastName: lastName.trim(), suffix: suffix.trim() || undefined,
        sex: sex ?? undefined, mobileNumber: mobileNumber.trim(), email: email.trim(), houseNo: houseNo.trim(), street: street.trim(),
        employmentStatus: employmentStatus ?? undefined, occupation: occupation.trim() || undefined, birthDate: isoDate(birthDate),
        password, confirmPassword, barangayId: config.barangayId,
      });
      const { data, error: signUpError } = await client.auth.signUp({
        email: input.email,
        password: input.password,
        options: { data: {
          first_name: input.firstName, middle_name: input.middleName ?? null, last_name: input.lastName, suffix: input.suffix ?? null,
          sex: input.sex, mobile_number: input.mobileNumber, house_no: input.houseNo, street: input.street,
          employment_status: input.employmentStatus, occupation: input.occupation ?? null, birth_date: input.birthDate,
          barangay_id: config.barangayId, location_verified: null, registration_lat: null, registration_lng: null,
        } },
      });
      if (signUpError) throw signUpError;
      if (!data.session) throw new PublicError('Account creation requires email confirmation, but that flow is not enabled in this app. Please contact your barangay.');
      await logout();
      router.replace({ pathname: '/auth', params: { registered: '1' } });
    } catch (failure) { setError(residentError(failure)); }
    finally { setBusy(false); }
  }

  return <Screen><Body heading>Create your resident account</Body><Body>Your barangay is assigned by this installation and cannot be changed here.</Body>
    <Card><Body heading>Personal information</Body>
      <Field label="First name" value={firstName} onChangeText={setFirstName} textContentType="givenName" editable={!busy} />
      <Field label="Middle name (optional)" value={middleName} onChangeText={setMiddleName} textContentType="middleName" editable={!busy} />
      <Field label="Last name" value={lastName} onChangeText={setLastName} textContentType="familyName" editable={!busy} />
      <Field label="Suffix (optional)" value={suffix} onChangeText={setSuffix} editable={!busy} />
      <Choices label="Sex" values={['male', 'female'] as const} selected={sex} display={(value) => value === 'male' ? 'Male' : 'Female'} onChange={setSex} />
      <Body>Date of birth</Body><DateTimePicker value={birthDate} onValueChange={(_, date) => setBirthDate(date)} mode="date" display="compact" maximumDate={new Date()} disabled={busy} />
      <Field label="Mobile number" value={mobileNumber} onChangeText={setMobileNumber} keyboardType="phone-pad" textContentType="telephoneNumber" maxLength={11} editable={!busy} />
    </Card>
    <Card><Body heading>Home address</Body><Field label="House or unit number" value={houseNo} onChangeText={setHouseNo} textContentType="streetAddressLine1" editable={!busy} /><Field label="Street" value={street} onChangeText={setStreet} textContentType="streetAddressLine2" editable={!busy} /></Card>
    <Card><Body heading>Employment</Body><Choices label="Employment status" values={EMPLOYMENT_STATUSES} selected={employmentStatus} display={(value) => employmentLabels[value]} onChange={setEmploymentStatus} />
      {employmentStatus && EMPLOYMENT_STATUSES_WITH_OCCUPATION.includes(employmentStatus) && <Field label="Occupation (optional)" value={occupation} onChangeText={setOccupation} editable={!busy} />}
    </Card>
    <Card><Body heading>Sign-in details</Body><Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" textContentType="emailAddress" autoCapitalize="none" editable={!busy} /><Field label="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" autoCapitalize="none" editable={!busy} /><Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry textContentType="newPassword" autoCapitalize="none" editable={!busy} /></Card>
    {!!error && <Notice message={error} />}<Action label={busy ? 'Creating account…' : 'Create account'} disabled={busy} onPress={() => void submit()} /><Action label="Back to sign in" secondary disabled={busy} onPress={() => router.back()} />
  </Screen>;
}
