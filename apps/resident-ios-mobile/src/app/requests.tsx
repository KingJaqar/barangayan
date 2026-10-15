import { Card, Destination } from '../components/ui';
import { RequestStatus } from '../components/request-status';
import { RequireResident } from '../components/require-resident';
import { ResourceList } from '../components/resource-list';
import { useApi } from '../data/use-api';
import { usePagedResource } from '../data/use-paged-resource';
import { useResident } from '../lib/runtime';
export default function Requests() {
  return <RequireResident purpose="view your document requests"><OwnRequests /></RequireResident>;
}
function OwnRequests() {
  const api = useApi();
  const { session } = useResident();
  const resource = usePagedResource('requests', api.requests(), session ? [{ table: 'service_requests', filter: `resident_id=eq.${session.user.id}` }] : []);
  return <ResourceList resource={resource} empty={{ title: 'No requests yet', message: 'Requests you submit will appear here.' }} render={(request) => <Card><Destination title={request.document_types?.name ?? request.reference_number} detail={request.reference_number} href={{ pathname: '/request/[id]', params: { id: request.id } }} /><RequestStatus status={request.status} paymentStatus={request.payment_status} /></Card>} />;
}
