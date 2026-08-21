import { ActiveDrivesContent } from '@/components/health/active-drives-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/**
 * Active Medical Drives [C-015] — guest-accessible (medical_drives_public_read has no
 * `to` clause, so it already covers anon per the 0035 migration). Browsing the calendar
 * and drive list needs no account; only the Register action underneath does, so
 * ActiveDrivesContent/DriveCard gate that one action instead of the whole page — same
 * split as /services/documents (browsable) vs. its request flow.
 */
export default async function HealthPage() {
  const { user } = await getOptionalUser();
  return <ActiveDrivesContent userId={user?.id ?? null} />;
}
