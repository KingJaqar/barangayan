import { StaticPlaceholder } from '@/components/admin/static-placeholder';

// Depends on the same not-yet-built incident_reports table + geodata as Incident Reports.
export default function IncidentMapPage() {
  return (
    <StaticPlaceholder
      icon="📍"
      title="Incident Map"
      description="A geographic view of reported incidents is planned once incident reporting lands."
    />
  );
}
