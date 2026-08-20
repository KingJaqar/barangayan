import { MyRegistrationsContent } from '@/components/health/my-registrations-content';
import { requireUser } from '@/lib/auth/require-user';

/** My Registrations [C-016] — resident-only per the plan's §4 Route Contract Matrix. */
export default async function MyRegistrationsPage() {
  const { user } = await requireUser();
  return <MyRegistrationsContent userId={user.id} />;
}
