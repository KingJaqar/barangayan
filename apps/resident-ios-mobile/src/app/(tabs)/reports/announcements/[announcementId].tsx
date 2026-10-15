import { formatDateTime } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { createSingleFlight } from '../../../../data/mutation';
import { Action, Body, Card, Destination, EmptyState, Notice, ResourceState, Screen } from '../../../../components/ui';
import { useApi } from '../../../../data/use-api';
import { useReportCounts } from '../../../../data/report-counts';
import { useResource } from '../../../../data/use-resource';
import { residentError } from '../../../../lib/errors';
import { useResident } from '../../../../lib/runtime';

export default function Announcement() {
  const { announcementId } = useLocalSearchParams();
  const api = useApi();
  const { session } = useResident();
  const { refresh: refreshCounts } = useReportCounts();
  const resource = useResource(`announcement:${announcementId}`, (signal) => api.announcement(announcementId, signal));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [gate] = useState(createSingleFlight);
  async function markRead() {
    setBusy(true); setMessage('');
    const outcome = await gate.run(() => api.markAnnouncementRead(announcementId));
    setBusy(false);
    if (outcome.status === 'busy') return;
    // The read upsert is idempotent, so the counters are refreshed for every outcome.
    refreshCounts();
    setMessage(outcome.status === 'committed' ? 'Marked as read.' : residentError(outcome.error));
  }
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />
    {resource.data === null && <EmptyState title="Announcement unavailable" message="This announcement was removed or is not published for your barangay."><Destination title="Back to Reports" href="/reports" /></EmptyState>}
    {resource.data && <Card><Body heading>{resource.data.title}</Body><Body role="footnote" tone="secondary">{resource.data.category} · {formatDateTime(resource.data.published_at)}</Body><Body>{resource.data.body}</Body>{resource.data.detailed_description && <Body>{resource.data.detailed_description}</Body>}
      {session && <Action label={busy ? 'Marking as read…' : 'Mark as read'} secondary disabled={busy} onPress={() => void markRead()} />}{!!message && <Notice message={message} />}</Card>}
  </Screen>;
}
