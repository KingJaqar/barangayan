import { formatDateTime } from '@barangayan/shared';
import type { ReactNode } from 'react';
import { RequestStatus } from '../../components/request-status';
import { RequireResident } from '../../components/require-resident';
import { ResourceList } from '../../components/resource-list';
import { Body, Card, Destination } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { usePagedResource } from '../../data/use-paged-resource';
import { useResident } from '../../lib/runtime';
import { feeLine } from './request-tracking';

/**
 * Logs (A18): the latest state of each of the resident's requests, most recently updated
 * first. It is derived from the request records, not an event stream, and says so; it is
 * never presented as a complete audit trail.
 */
export function OwnLogs({ header }: { header?: ReactNode }) {
  return <RequireResident purpose="see your request activity"><LogList header={header} /></RequireResident>;
}

function LogList({ header }: { header?: ReactNode }) {
  const api = useApi();
  const { session } = useResident();
  const resource = usePagedResource('request-activity', api.activity(), session ? [{ table: 'service_requests', filter: `resident_id=eq.${session.user.id}` }] : []);
  return <ResourceList resource={resource}
    header={<>{header}<Body role="footnote" tone="secondary">The latest update on each of your requests. This is a summary of current status, not a full history of every change.</Body></>}
    empty={{ title: 'No activity yet', message: 'Updates on your document requests will be listed here.' }}
    render={(row) => <Card>
      <Destination title={row.document_types?.name ?? row.reference_number} detail={row.reference_number} href={{ pathname: '/request/[id]', params: { id: row.id } }} />
      <Body role="footnote" tone="secondary">{`Updated ${formatDateTime(row.updated_at)}`}</Body>
      <RequestStatus status={row.status} paymentStatus={row.payment_status} />
      <Body>{feeLine(row)}</Body>
    </Card>} />;
}
