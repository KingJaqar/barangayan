import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Action, Body, Card, Field, Notice, ResourceState, Screen, Toggle, Unavailable } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { routeId } from '../../../data/resident-api';
import { useResource } from '../../../data/use-resource';
import { residentError } from '../../../lib/errors';
import { releaseGates } from '../../../lib/release-gates';
import { useResident } from '../../../lib/runtime';

const isoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
function ageFrom(value: string | null) {
  if (!value) return null;
  const born = new Date(`${value}T12:00:00`); if (Number.isNaN(born.valueOf())) return null;
  const now = new Date(); let age = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age--;
  return age;
}

export default function DriveRegistration() {
  const { id } = useLocalSearchParams();
  const { session, profile } = useResident(); const api = useApi();
  const resource = useResource(`register-drive:${id}`, async (signal) => { const valid = routeId(id); return (await api.drives(signal)).find((row) => row.id === valid) ?? null; });
  const profileAge = useMemo(() => ageFrom(profile?.birth_date ?? null), [profile?.birth_date]);
  const [age, setAge] = useState(profileAge === null ? '' : String(profileAge)); const [pwd, setPwd] = useState(false);
  const [conditions, setConditions] = useState(''); const [hasPriorDose, setHasPriorDose] = useState(false); const [priorDoseDate, setPriorDoseDate] = useState(new Date());
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [result, setResult] = useState('');
  if (!session) return <Redirect href="/auth" />;
  if (!releaseGates.medicalRegistration) return <Screen><Unavailable service="Medical drive registration" /></Screen>;
  async function submit() {
    if (busy) return;
    if (!consent) { setMessage('Review and accept the health-data consent before registering.'); return; }
    setBusy(true); setMessage('');
    try {
      const response = await api.registerForDrive({ driveId: id, age: Number(age), isPwd: pwd, comorbidities: conditions.split(',').map((item) => item.trim()).filter(Boolean), ...(hasPriorDose ? { priorDoseDate: isoDate(priorDoseDate) } : {}) }) as { applicant_number?: string };
      setResult(response.applicant_number ?? 'Registered'); setMessage('Registration confirmed by the server.');
    } catch (failure) { setMessage(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data && <><Body heading>{resource.data.title}</Body><Card><Body>Registration is for your own resident profile. The barangay computes eligibility priority and final status.</Body><Field label="Age" value={age} onChangeText={setAge} keyboardType="number-pad" editable={profileAge === null && !busy} /><Toggle label="Person with disability" value={pwd} onChange={setPwd} disabled={busy} /><Field label="Medical conditions, separated by commas (optional)" value={conditions} onChangeText={setConditions} multiline editable={!busy} /><Toggle label="I have a prior dose" value={hasPriorDose} onChange={setHasPriorDose} disabled={busy} />{hasPriorDose && <><Body>Actual prior dose date</Body><DateTimePicker value={priorDoseDate} onValueChange={(_, value) => setPriorDoseDate(value)} mode="date" display="compact" maximumDate={new Date()} disabled={busy} /></>}<Toggle label="I consent to using these health details for this registration" value={consent} onChange={setConsent} disabled={busy} /></Card>{!!message && <Notice message={message} />}{!!result && <Card><Body heading>Applicant number</Body><Body>{result}</Body></Card>}<Action label={busy ? 'Registering…' : 'Register for this drive'} disabled={busy || !!result} onPress={() => void submit()} /></>}</Screen>;
}
