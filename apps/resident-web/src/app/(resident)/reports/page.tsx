import { requireUser } from '@/lib/auth/require-user';
import { MyReportsTabs } from './my-reports-tabs';

export default async function ReportsPage() {
  await requireUser();

  // Header, width, and tab/list layout all live in MyReportsTabs (client) — it needs to
  // react to whether the IncidentDrawer is open to reflow the page around it.
  return <MyReportsTabs />;
}
