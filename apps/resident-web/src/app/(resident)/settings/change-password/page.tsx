import { requireUser } from '@/lib/auth/require-user';
import { ChangePasswordForm } from './change-password-form';

export const metadata = { title: 'Change Password' };

export default async function ChangePasswordPage() {
  const { user } = await requireUser();
  // Pass the email so the form can re-authenticate via signInWithPassword — Supabase's
  // updateUser() doesn't verify the old password, so we gate behind a re-auth step.
  return (
    <div className="mx-auto max-w-md px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Change Password</h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Enter your current password, then choose a new one (at least 8 characters).
        </p>
      </div>
      <ChangePasswordForm email={user.email ?? ''} />
    </div>
  );
}
