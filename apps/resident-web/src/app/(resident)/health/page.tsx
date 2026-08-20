import { ActiveDrivesContent } from '@/components/health/active-drives-content';
import { requireUser } from '@/lib/auth/require-user';

/** Active Medical Drives [C-015] — resident-only per the plan's §4 Route Contract Matrix
 * ("(resident)/health/* (3 routes) | R"). */
export default async function HealthPage() {
  const { user } = await requireUser();
  return <ActiveDrivesContent userId={user.id} />;
}
