import { getOptionalUser } from '@/lib/auth/get-optional-user';
import { AboutClient } from './about-client';

export const metadata = { title: 'About Us' };

/** Guest-accessible (getOptionalUser(), not requireUser()) — about_us has an anon read
 * policy (0059 migration's "guests read active about_us"), so a guest can read the same
 * About Us a resident sees, no account needed. */
export default async function AboutPage() {
  const { profile } = await getOptionalUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">About Us</h1>
      </div>
      <AboutClient barangayId={profile?.barangay_id ?? null} />
    </div>
  );
}
