import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Action, Body, Card, Notice, ResourceState, Screen } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
import { useResident } from '../../../lib/runtime';
import { residentError } from '../../../lib/errors';
export default function Announcement() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const { session } = useResident();
  const resource = useResource(`announcement:${id}`, (signal) => api.announcement(id, signal));
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data === null && <Body>This announcement is unavailable.</Body>}{resource.data && <Card><Body heading>{resource.data.title}</Body><Body>{resource.data.body}</Body>{resource.data.detailed_description && <Body>{resource.data.detailed_description}</Body>}{session && <Action label="Mark as read" disabled={busy} onPress={() => {
    setBusy(true); void api.markAnnouncementRead(id).then(() => setMessage('Marked as read.')).catch((error) => setMessage(residentError(error))).finally(() => setBusy(false));
  }} />}{!!message && <Notice message={message} />}</Card>}</Screen>;
}
