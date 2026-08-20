import { requireUser } from '@/lib/auth/require-user';
import { AboutClient } from './about-client';

export const metadata = { title: 'About Us' };

export default async function AboutPage() {
  const { profile } = await requireUser();

  return (
    <div className="mx-auto max-w-5xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">About Us</h1>
      </div>
      <AboutClient barangayId={profile.barangay_id} />
    </div>
  );
}
