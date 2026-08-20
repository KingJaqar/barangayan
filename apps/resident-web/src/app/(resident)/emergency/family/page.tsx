import { FamilyContent } from '@/components/emergency/family-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/** Household member management [C-009, C-038, C-044] — one of two entry points sharing
 * useFamilyMembers (the other is Phase 7's profile editor, not yet built).
 *
 * Guest-accessible route (uses getOptionalUser(), not requireUser()) — a signed-out
 * visitor stays on this page and sees an inline "requires an account" gate instead of
 * being force-navigated to /login. The household roster still requires a real account
 * underneath (RLS on profiles), so guests only ever see the gate.
 */
export default async function EmergencyFamilyPage() {
  const { user, profile } = await getOptionalUser();

  return <FamilyContent profileId={user?.id ?? null} residentName={profile?.full_name ?? null} />;
}
