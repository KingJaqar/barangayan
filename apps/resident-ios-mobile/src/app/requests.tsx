import { getResidentRequestStatus, RESIDENT_STATUS_LABEL } from '@barangayan/shared';
import { Card, Destination, Screen } from '../components/ui';
import { ResourceList } from '../components/resource-list';
import { useResident } from '../lib/runtime';
import { useApi } from '../data/use-api';
import { useResource } from '../data/use-resource';
export default function Requests() {
  const { session } = useResident();
  return session ? <OwnRequests /> : <Screen><Destination title="Sign in to view your requests" href="/auth" /></Screen>;
}
function OwnRequests() {
  const api = useApi();
  const resource = useResource('requests', api.requests);
  return <ResourceList resource={resource} empty="You have no document requests yet." render={(request) => <Card><Destination title={request.document_types?.name ?? request.reference_number} detail={`${request.reference_number} · ${RESIDENT_STATUS_LABEL[getResidentRequestStatus(request.status, request.payment_status)]}`} href={{ pathname: '/request/[id]', params: { id: request.id } }} /></Card>} />;
}
