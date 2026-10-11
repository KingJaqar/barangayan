import { safeResidentRedirect } from '@barangayan/shared';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { ResidentDetailsForm } from '@/components/resident-details-form';
import { useAuth } from '@/hooks/use-auth';
export default function CompleteProfile() {
  const { session, refreshCompletion, setSetupIntent } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ next?: string }>();
  return <ResidentDetailsForm key={session?.user.id} required={false} onBack={() => router.replace('/home')} onSkip={() => router.replace('/home')} onSaved={async () => {
    await setSetupIntent('google_details_saved'); await refreshCompletion();
    // Optional password is handled by the root guard. Other accounts retain the
    // existing service continuation destination after fresh server status.
    router.replace(safeResidentRedirect(params.next ?? null) as Href);
  }} />;
}
