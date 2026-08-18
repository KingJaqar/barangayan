import { GuestAuthCalloutScreen } from '@/components/guest-auth-callout-screen';
import { AuthenticatedScanView } from '@/components/authenticated-scan-view';
import { useAuth } from '@/hooks/use-auth';

export default function ScanTabScreen() {
  const { session } = useAuth();
  const isGuest = !session || !session?.user;

  if (isGuest) {
    return (
      <GuestAuthCalloutScreen
        title="Account Required for Emergency QR"
        description="Log in or register an account to scan evacuation center QR codes or display your household check-in QR code during disasters."
        tabName="Scan"
      />
    );
  }

  return <AuthenticatedScanView userId={session.user.id} />;
}
