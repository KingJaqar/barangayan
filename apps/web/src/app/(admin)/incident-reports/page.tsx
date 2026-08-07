import { StaticPlaceholder } from '@/components/admin/static-placeholder';

// No incident_reports table exists yet — only a client-side Zod schema was scaffolded
// ahead of Module 3 (packages/shared/src/schemas/incident-report.ts).
export default function IncidentReportsPage() {
  return (
    <StaticPlaceholder
      icon="⚠"
      title="Incident Reports"
      description="Community incident reporting and review tools are planned for a future module."
    />
  );
}
