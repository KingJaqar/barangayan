import { Redirect, useLocalSearchParams } from 'expo-router';
import { Destination, EmptyState, Screen } from '../../../components/ui';
import { uuid } from '../../../data/resident-api';

/** Earlier iOS links used /reports/[id] for announcements only; they resolve to the typed announcement route. */
export default function LegacyAnnouncementLink() {
  const { id } = useLocalSearchParams();
  const parsed = uuid.safeParse(id);
  if (!parsed.success) return <Screen><EmptyState title="Link not recognized" message="This link does not point to an announcement."><Destination title="Back to Reports" href="/reports" /></EmptyState></Screen>;
  return <Redirect href={{ pathname: '/reports/announcements/[announcementId]', params: { announcementId: parsed.data } }} />;
}
