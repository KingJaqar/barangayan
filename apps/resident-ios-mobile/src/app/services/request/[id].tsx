import { requestFormSchema } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { RequireResident } from '../../../components/require-resident';
import { Action, Body, Card, Field, Notice, ResourceState, Screen, useDiscardGuard } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
import { residentError } from '../../../lib/errors';

export default function RequestFormRoute() {
  return <RequireResident purpose="request documents"><RequestForm /></RequireResident>;
}
function RequestForm() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();
  const resource = useResource(`request-document:${id}`, (signal) => api.document(id, signal));
  const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [created, setCreated] = useState<string | null>(null);
  useDiscardGuard(!busy && !created && !!notes.trim());
  // Navigate only after the guard has observed the committed request, so leaving is not treated as discarding input.
  useEffect(() => { if (created) router.replace({ pathname: '/request/[id]', params: { id: created } }); }, [created, router]);
  async function submit() {
    if (busy || !resource.data) return;
    setBusy(true); setError('');
    try {
      const input = requestFormSchema.parse({ documentTypeId: resource.data.id, requesterNotes: notes.trim() || undefined });
      const request = await api.createRequest(input.documentTypeId, input.requesterNotes);
      setCreated(request.id);
    } catch (failure) { setError(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data && <><Body heading>Request {resource.data.name}</Body><Card><Body>Review the listed requirements before submitting. Barangay staff will verify originals during processing or pickup.</Body><Field label="Notes for the barangay (optional)" value={notes} onChangeText={setNotes} multiline maxLength={1000} editable={!busy} /></Card>{!!error && <Notice tone="danger" message={error} />}<Action label={busy ? 'Submitting…' : 'Submit request'} disabled={busy || !!created} onPress={() => void submit()} /></>}</Screen>;
}
