import { requestFormSchema } from '@barangayan/shared';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Action, Body, Card, Field, Notice, ResourceState, Screen } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
import { residentError } from '../../../lib/errors';
import { useResident } from '../../../lib/runtime';

export default function RequestForm() {
  const { id } = useLocalSearchParams();
  const { session } = useResident();
  const api = useApi();
  const router = useRouter();
  const resource = useResource(`request-document:${id}`, (signal) => api.document(id, signal));
  const [notes, setNotes] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  if (!session) return <Redirect href="/auth" />;
  async function submit() {
    if (busy || !resource.data) return;
    setBusy(true); setError('');
    try {
      const input = requestFormSchema.parse({ documentTypeId: resource.data.id, requesterNotes: notes.trim() || undefined });
      const request = await api.createRequest(input.documentTypeId, input.requesterNotes);
      router.replace({ pathname: '/request/[id]', params: { id: request.id } });
    } catch (failure) { setError(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data && <><Body heading>Request {resource.data.name}</Body><Card><Body>Review the listed requirements before submitting. Barangay staff will verify originals during processing or pickup.</Body><Field label="Notes for the barangay (optional)" value={notes} onChangeText={setNotes} multiline maxLength={1000} editable={!busy} /></Card>{!!error && <Notice message={error} />}<Action label={busy ? 'Submitting…' : 'Submit request'} disabled={busy} onPress={() => void submit()} /></>}</Screen>;
}
