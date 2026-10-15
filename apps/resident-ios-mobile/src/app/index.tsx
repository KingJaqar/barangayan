import { Redirect } from 'expo-router';
import { useAuthFlow } from '../auth/auth-flow';
import { AuthenticatedRedirect } from '../features/auth/parts';
import { useResident } from '../lib/runtime';

/** Root decision only: recovery, a restored session, guest browsing, otherwise account choice. */
export default function Index() {
  const { session, recovery } = useResident();
  const { guest } = useAuthFlow();
  if (recovery) return <Redirect href="/auth/recovery" />;
  if (session) return <AuthenticatedRedirect />;
  return <Redirect href={guest ? '/home' : '/auth/choice'} />;
}
