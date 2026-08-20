import { requireUser } from '@/lib/auth/require-user';
import { HelpCenterClient } from './help-center-client';

export const metadata = { title: 'Help Center' };

export default async function HelpCenterPage() {
  const { profile } = await requireUser();

  return (
    <div className="mx-auto max-w-4xl px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold tracking-tight">Help Center</h1>
        <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
          Answers to common questions about Barangayan and your barangay&apos;s services.
        </p>
      </div>
      <HelpCenterClient barangayId={profile.barangay_id} />
    </div>
  );
}
