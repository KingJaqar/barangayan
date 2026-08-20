'use client';

/**
 * Change-password form — near-verbatim port of mobile's change-password.tsx logic.
 * Re-authenticates via signInWithPassword before calling updateUser(), matching mobile's
 * rationale: Supabase's updateUser() doesn't check the old password, so a session left
 * open on a shared/lost device shouldn't be able to silently change the password.
 */

import { changePasswordSchema } from '@barangayan/shared';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const inputCls =
  'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100';

function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={`${inputCls} pr-10`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShow((v) => !v)}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
    </label>
  );
}

export function ChangePasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    const result = changePasswordSchema.safeParse({ currentPassword, newPassword, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    if (!email) {
      toast.error('Your account has no email on file. Contact barangay staff for help.');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Re-authenticate first — guards against a stolen/left-open session.
      const { error: reauthError } = await supabase.auth.signInWithPassword({
        email,
        password: result.data.currentPassword,
      });

      if (reauthError) {
        if (reauthError.message.toLowerCase().includes('invalid login credentials')) {
          setFieldErrors({ currentPassword: 'Current password is incorrect.' });
        } else if (reauthError.message.toLowerCase().includes('rate limit')) {
          toast.error('Too many attempts. Please wait a moment and try again.');
        } else {
          toast.error(reauthError.message);
        }
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: result.data.newPassword });
      if (updateError) {
        toast.error(updateError.message);
        return;
      }

      // Clear the form then navigate back to settings.
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully.');
      router.push('/settings');
    } catch {
      toast.error('Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Context card */}
      <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800/50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <ShieldCheck size={18} className="text-[var(--accent)]" />
        </span>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your current password is required to confirm your identity before setting a new one.
        </p>
      </div>

      {/* Fields */}
      <div className="space-y-4 rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <PasswordField
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          error={fieldErrors.currentPassword}
          autoComplete="current-password"
        />
        <hr className="border-zinc-100 dark:border-zinc-800" />
        <PasswordField
          label="New Password"
          value={newPassword}
          onChange={setNewPassword}
          error={fieldErrors.newPassword}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword}
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={submitting || !currentPassword || !newPassword || !confirmPassword}
        className="w-full rounded-full bg-[var(--accent)] py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
        {submitting ? 'Updating…' : 'Update Password'}
      </button>
    </form>
  );
}
