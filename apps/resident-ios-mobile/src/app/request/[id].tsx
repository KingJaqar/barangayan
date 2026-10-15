import { formatDateTime } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { createSingleFlight } from '../../data/mutation';
import { Action, Body, Card, confirmDestructive, Destination, EmptyState, Notice, ResourceState, Screen, Unavailable } from '../../components/ui';
import { RequestStatus } from '../../components/request-status';
import { RequireResident } from '../../components/require-resident';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { residentError } from '../../lib/errors';
export default function RequestDetail() {
  return <RequireResident purpose="view your request"><OwnRequest /></RequireResident>;
}
function OwnRequest() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const resource = useResource(`request:${id}`, (signal) => api.request(id, signal));
  const request = resource.data;
  const [gate] = useState(createSingleFlight);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const cancellable = request && !['ready_for_pickup', 'completed', 'cancelled'].includes(request.status) && request.payment_status !== 'paid';
  async function cancel() {
    if (gate.running) return;
    if (!await confirmDestructive({ title: 'Cancel this request?', message: 'The barangay will stop processing it. This cannot be undone.', confirmLabel: 'Cancel request' })) return;
    setBusy(true); setMessage('');
    const outcome = await gate.run(() => api.cancelRequest(id));
    setBusy(false);
    if (outcome.status === 'busy') return;
    // Every outcome re-reads the request: the server, not this screen, says whether it is cancelled.
    await resource.refresh();
    setMessage(outcome.status === 'committed' ? 'Request cancelled.' : residentError(outcome.error));
  }
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{request === null && <EmptyState title="Request not found" message="This request is unavailable to this account."><Destination title="My requests" href="/requests" /></EmptyState>}{request && <><Card><Body heading>{request.document_types?.name ?? 'Document request'}</Body><Body role="monoReference">{request.reference_number}</Body><RequestStatus status={request.status} paymentStatus={request.payment_status} />{!!request.requester_notes && <Body>{request.requester_notes}</Body>}<Body tone="secondary">Payment method: {request.payment_method ?? 'Not selected'}</Body><Body tone="secondary">Last updated: {formatDateTime(request.updated_at)}</Body></Card>{cancellable && <Action label={busy ? 'Cancelling…' : 'Cancel request'} secondary destructive disabled={busy} onPress={() => void cancel()} />}{!!message && <Notice message={message} />}<Unavailable service="Payment and receipt actions" /></>}</Screen>;
}
