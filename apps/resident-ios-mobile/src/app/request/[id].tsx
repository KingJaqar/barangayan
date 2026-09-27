import { getResidentRequestStatus, RESIDENT_STATUS_LABEL } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Action, Body, Card, Destination, Notice, ResourceState, Screen, Unavailable } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { useResident } from '../../lib/runtime';
import { residentError } from '../../lib/errors';
export default function RequestDetail() {
  const { session } = useResident();
  return session ? <OwnRequest /> : <Screen><Destination title="Sign in to view your request" href="/auth" /></Screen>;
}
function OwnRequest() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const resource = useResource(`request:${id}`, (signal) => api.request(id, signal));
  const request = resource.data;
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const cancellable = request && !['ready_for_pickup', 'completed', 'cancelled'].includes(request.status) && request.payment_status !== 'paid';
  async function cancel() {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await api.cancelRequest(id); await resource.refresh(); setMessage('Request cancelled.'); }
    catch (failure) { setMessage(residentError(failure)); }
    finally { setBusy(false); }
  }
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{request === null && <Body>Request not found or unavailable to this account.</Body>}{request && <><Card><Body heading>{request.document_types?.name ?? 'Document request'}</Body><Body>{request.reference_number}</Body><Body>{RESIDENT_STATUS_LABEL[getResidentRequestStatus(request.status, request.payment_status)]}</Body><Body>{request.requester_notes}</Body><Body>Payment method: {request.payment_method ?? 'Not selected'}</Body><Body>Last updated: {new Date(request.updated_at).toLocaleString()}</Body></Card>{cancellable && <Action label={busy ? 'Cancelling…' : 'Cancel request'} secondary disabled={busy} onPress={() => void cancel()} />}{!!message && <Notice message={message} />}<Unavailable service="Payment and receipt actions" /></>}</Screen>;
}
