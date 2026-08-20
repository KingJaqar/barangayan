import { ScanContent } from '@/components/emergency/scan-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/** QR check-in guide + camera scanner + desktop upload fallback + "Show QR"
 * [C-011, C-012, C-014].
 *
 * Guest-accessible route (uses getOptionalUser(), not requireUser()) — a signed-out
 * visitor stays on this page and sees an inline "requires an account" gate instead of
 * being force-navigated to /login. Check-in still requires a real account underneath
 * (RLS on qr_checkins), so guests only ever see the gate, never the scanner itself.
 */
export default async function EmergencyScanPage() {
  const { user, profile } = await getOptionalUser();

  return <ScanContent userId={user?.id ?? null} barangayId={profile?.barangay_id ?? null} />;
}
