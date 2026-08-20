import { requireUser } from '@/lib/auth/require-user';
import { TermsPrivacyClient } from './terms-privacy-client';

export const metadata = { title: 'Terms & Privacy Policy' };

export default async function TermsPrivacyPage() {
  const { profile } = await requireUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Terms & Privacy Policy</h1>
      </div>
      <TermsPrivacyClient barangayId={profile.barangay_id} />
    </div>
  );
}
