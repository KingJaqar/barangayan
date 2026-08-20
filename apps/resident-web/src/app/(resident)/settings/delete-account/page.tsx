import { requireUser } from '@/lib/auth/require-user';
import { DeleteAccountForm } from './delete-account-form';

export const metadata = { title: 'Delete Account' };

export default async function DeleteAccountPage() {
  const { user } = await requireUser();
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Delete My Account</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          This permanently anonymizes your profile and signs you out for good. Your service request and
          incident history stays on file for the barangay&apos;s records, but is no longer linked to your name.
          This cannot be undone.
        </p>
      </div>
      <DeleteAccountForm email={user.email ?? ''} />
    </div>
  );
}
