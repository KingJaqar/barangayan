import { AuthGate } from '@/components/shared/auth-gate';
import { MyRegistrationsContent } from '@/components/health/my-registrations-content';
import { getOptionalUser } from '@/lib/auth/get-optional-user';

/**
 * My Registrations [C-016] — inherently personal (a guest has no registrations to
 * list), so this stays a guest-accessible route (getOptionalUser(), not requireUser())
 * that shows an inline sign-in gate instead of force-navigating away — same pattern as
 * Emergency's Scan/Family.
 */
export default async function MyRegistrationsPage() {
  const { user } = await getOptionalUser();

  if (!user) {
    return (
      <AuthGate
        title="Log In to See Your Registrations"
        description="Your medical and vaccination drive registrations are tied to your account. Log in or create one to view them."
        next="/health/my-registrations"
      />
    );
  }

  return <MyRegistrationsContent userId={user.id} />;
}
