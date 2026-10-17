import { useLocalSearchParams } from 'expo-router';
import { DocumentDetail } from '../../../features/services/document-detail';

export default function ServiceDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // Keyed by id so a different service never inherits the previous one's load and apply state.
  return <DocumentDetail key={id} id={id} />;
}
