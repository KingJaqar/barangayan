import { formatDate } from '@barangayan/shared';
import { useEffect, useState, type ReactNode } from 'react';
import { RequestStatus } from '../../components/request-status';
import { RequireResident } from '../../components/require-resident';
import { ResourceList } from '../../components/resource-list';
import { Body, Card, Destination, Segmented } from '../../components/ui';
import { ACTIVE_OPTIONS, ALL_REQUESTS, GROUP_OPTIONS, withGroup, type ActiveSub, type RequestFilter, type RequestGroup } from '../../data/request-filters';
import { subscribeToChanges } from '../../data/realtime';
import { useApi } from '../../data/use-api';
import { usePagedResource } from '../../data/use-paged-resource';
import { useResource } from '../../data/use-resource';
import { useLatest } from '../../lib/use-latest';
import { useResident } from '../../lib/runtime';

/** The signed-in resident's requests; Services embeds it as a segment and `/requests` serves it as a route. */
export function OwnRequests({ header, purpose = 'view your document requests' }: { header?: ReactNode; purpose?: string }) {
  return <RequireResident purpose={purpose}><OwnRequestList header={header} /></RequireResident>;
}

function OwnRequestList({ header }: { header?: ReactNode }) {
  const api = useApi();
  const { client, session } = useResident();
  const [filter, setFilter] = useState<RequestFilter>(ALL_REQUESTS);
  const owner = session?.user.id;
  const sources = owner ? [{ table: 'service_requests', filter: `resident_id=eq.${owner}` }] : [];
  const resource = usePagedResource(`requests:${filter.group}:${filter.sub}`, api.requests(filter), sources);
  const counts = useResource('request-counts', (signal) => api.requestCounts(signal));
  const refreshCounts = useLatest(counts.refresh);
  // Counts come from the server; any change to the resident's own requests re-reads them.
  useEffect(() => {
    if (!owner) return;
    return subscribeToChanges(client, 'request-counts', [{ table: 'service_requests', filter: `resident_id=eq.${owner}` }], () => void refreshCounts.current());
  }, [client, owner, refreshCounts]);

  const groups = GROUP_OPTIONS.map((option) => ({ value: option.value, label: counts.data ? `${option.label} (${counts.data[option.value]})` : option.label }));
  const controls = <>
    {header}
    <Segmented<RequestGroup> label="Request group" options={groups} selected={filter.group} onChange={(group) => setFilter(withGroup(group))} />
    {filter.group === 'active' && <Segmented<ActiveSub> label="Active request status" options={ACTIVE_OPTIONS} selected={filter.sub} onChange={(sub) => setFilter({ group: 'active', sub })} />}
  </>;
  return <ResourceList resource={resource} header={controls} filtered={filter.group !== 'all'}
    empty={{ title: 'No requests yet', message: 'Requests you submit will appear here.' }}
    noResults={{ title: 'No requests here', message: 'None of your requests match this filter. Choose another filter to see the rest.' }}
    render={(request) => <Card>
      <Destination title={request.document_types?.name ?? request.reference_number} detail={request.reference_number} href={{ pathname: '/request/[id]', params: { id: request.id } }} />
      <RequestStatus status={request.status} paymentStatus={request.payment_status} />
      <Body role="footnote" tone="secondary">{`Submitted ${formatDate(request.created_at)}`}</Body>
    </Card>} />;
}
