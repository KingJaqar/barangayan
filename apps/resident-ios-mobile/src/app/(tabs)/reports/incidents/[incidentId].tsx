import { IncidentDetailRoute } from '../../../../features/reports/incident-detail';

/** Typed incident destination (R18). The record type is never inferred from an ID; announcements have their own route. */
export default function IncidentDetail() {
  return <IncidentDetailRoute />;
}
