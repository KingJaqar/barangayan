import { useLocalSearchParams } from 'expo-router';
import { Destination, EmptyState, Screen, Unavailable } from '../../../../components/ui';
import { uuid } from '../../../../data/resident-api';

/** Typed incident destination (R18). Concern details are delivered in Phase 12; the record type is never inferred from an ID. */
export default function IncidentDetail() {
  const { incidentId } = useLocalSearchParams();
  if (!uuid.safeParse(incidentId).success) return <Screen><EmptyState title="Concern not found" message="This link does not identify a concern report."><Destination title="Back to Reports" href="/reports" /></EmptyState></Screen>;
  return <Screen><Unavailable service="Concern details" /><Destination title="Back to Reports" href="/reports" /></Screen>;
}
