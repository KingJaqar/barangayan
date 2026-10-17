import { formatDateTime } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { RequestStatus } from '../../components/request-status';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Destination, EmptyState, ResourceState, Screen } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';

export function ReceivedRoute() {
  return <RequireResident purpose="view your request"><Received /></RequireResident>;
}

/**
 * Result of a committed submission (A11-037, P08-T07). It reads the request back by id, so
 * the reference and status are the server's, and it survives reopening the app. A received
 * request is not a paid, approved or released one; payment and tracking are shown on the request.
 */
function Received() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const router = useRouter();
  const resource = useResource(`request-received:${id}`, (signal) => api.request(id, signal));
  const request = resource.data;
  return <Screen>
    <ResourceState loading={resource.loading && !request} error={resource.error} retry={() => void resource.refresh()} />
    {request === null && !resource.error && <EmptyState title="Request not found" message="This request is unavailable to this account. Open My requests to see your requests."><Destination title="My requests" href="/requests" /></EmptyState>}
    {request && <>
      <Card>
        <Body heading>Request received</Body>
        <Body>{request.document_types?.name ?? 'Document request'}</Body>
        <Body role="monoReference">{request.reference_number}</Body>
        <RequestStatus status={request.status} paymentStatus={request.payment_status} />
        <Body tone="secondary">{`Submitted ${formatDateTime(request.created_at)}`}</Body>
        <Body tone="secondary">Keep this reference number. Your request has been received for processing; it is not paid, approved or released yet. Follow its progress from your request.</Body>
      </Card>
      <Action label="View request" onPress={() => router.replace({ pathname: '/request/[id]', params: { id: request.id } })} />
      <Destination title="My requests" href="/requests" />
      <Destination title="Back to Services" href="/services" />
    </>}
  </Screen>;
}
