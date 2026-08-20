import { AlertsContent } from '@/components/emergency/alerts-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/**
 * Emergency-category announcements with time-window + custom date filters [C-007].
 * Guest-accessible (see emergency/page.tsx's doc comment for the rationale) — matches
 * /home's own guest branch, which already queries `announcements` unscoped for guests.
 */
export default async function EmergencyAlertsPage() {
  const { profile } = await getOptionalUser();

  return <AlertsContent barangayId={profile?.barangay_id ?? null} />;
}
