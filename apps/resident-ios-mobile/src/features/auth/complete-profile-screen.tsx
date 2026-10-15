import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthFlow } from '../../auth/auth-flow';
import { safeReturnPath } from '../../auth/pending-destination';
import { useResident } from '../../lib/runtime';
import { DetailsForm } from './details-form';

/**
 * Service-required profile completion. Public browsing never needs it; a service action does.
 * After the committed save the resident returns to the allowlisted action they started, or Home.
 */
export default function CompleteProfileScreen() {
  const { session, logout } = useResident();
  const { refreshSetup, setIntent, setup } = useAuthFlow();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  if (!session) return <Redirect href="/auth/choice" />;
  // A profile already committed on the server needs no remediation.
  if (setup.state === 'ready' && setup.status.profileComplete) return <Redirect href={safeReturnPath(typeof next === 'string' ? next : null) as '/home'} />;
  return <DetailsForm required={false} onSignOut={() => { void logout(); }}
    onSaved={async () => {
      await setIntent('sign_in');
      await refreshSetup();
      router.replace(safeReturnPath(typeof next === 'string' ? next : null) as '/home');
    }} />;
}
