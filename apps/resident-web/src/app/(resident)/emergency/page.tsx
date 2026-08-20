import { HubContent } from '@/components/emergency/hub-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/**
 * Emergency & DRRM Hub — bare /emergency IS the Hub (matches the plan's file tree:
 * "bare /emergency renders Hub content directly, no redirect needed"). Guidelines
 * accordion + hotlines list [C-013].
 *
 * Guest-accessible (uses getOptionalUser(), not requireUser()) — deliberately deviates
 * from the plan's §4 Route Contract Matrix, which marked all 5 Emergency routes "R". Per
 * explicit user direction: Hub/Centers/Alerts are read-only public-safety information and
 * `emergency_information`'s own RLS policy (migration 0069) already grants `anon` an
 * unscoped read — guests just don't get the barangay-scoping a signed-in resident does.
 * Scan and Family stay resident-only (requireUser()) since both write data tied to a real
 * account (a check-in, a household roster).
 */
export default async function EmergencyHubPage() {
  const { profile } = await getOptionalUser();

  return <HubContent barangayId={profile?.barangay_id ?? null} />;
}
