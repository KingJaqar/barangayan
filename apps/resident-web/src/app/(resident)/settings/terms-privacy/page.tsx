import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { TermsPrivacyClient } from './terms-privacy-client';

export const metadata = { title: 'Terms & Privacy Policy' };

/** Guest-accessible (getOptionalUser(), not requireUser()) — site_content has an anon
 * read policy (0059 migration's "guests read active site_content"), so a guest can read
 * the same Terms/Privacy a resident sees, no account needed. */
export default async function TermsPrivacyPage() {
  const { profile } = await getOptionalUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Terms & Privacy Policy</h1>
      </div>
      <TermsPrivacyClient barangayId={profile?.barangay_id ?? null} />
    </div>
  );
}
