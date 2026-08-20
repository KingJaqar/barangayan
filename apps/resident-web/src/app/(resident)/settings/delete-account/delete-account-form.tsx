'use client';

/**
 * Delete-account form — near-verbatim port of mobile's confirmDeleteAccount() logic
 * (settings/index.tsx lines 166-196). Two gates before the irreversible action runs:
 * a plain confirm checkbox/step, then a password re-entry (a session left open on a
 * shared/lost device shouldn't be enough on its own to permanently delete an account —
 * the delete-my-account edge function only checks that the caller holds *a* valid
 * session, not that the person holding it is the account owner right now).
 *
 * Per the plan's §14 Phase 7 note: walk this against a disposable test account only.
 */

import { AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

import { toEdgeFunctionError } from '@/lib/edge-function-error';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function DeleteAccountForm({ email }: { email: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'confirm' | 'password'>('confirm');
  const [acknowledged, setAcknowledged] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Your account has no email on file, so your password cannot be verified. Contact barangay staff for help.');
      return;
    }
    if (!password) return;

    setSubmitting(true);
    try {
      const supabase = createSupabaseBrowserClient();

      // Re-authenticate first — mirrors change-password's rationale.
      const { error: reauthError } = await supabase.auth.signInWithPassword({ email, password });
      if (reauthError) {
        if (reauthError.message.toLowerCase().includes('invalid login credentials')) {
          setError('Incorrect password.');
        } else if (reauthError.message.toLowerCase().includes('rate limit')) {
          setError('Too many attempts. Please wait a moment and try again.');
        } else {
          setError(reauthError.message);
        }
        return;
      }

      const { error: fnError } = await supabase.functions.invoke('delete-my-account');
      if (fnError) throw await toEdgeFunctionError(fnError);

      await supabase.auth.signOut();
      toast.success('Your account has been deleted.');
      router.push('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete your account. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (step === 'confirm') {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600 dark:text-red-400" />
          <ul className="list-disc space-y-1 pl-4 text-sm text-red-700 dark:text-red-300">
            <li>Your profile, photo, and ID documents will be permanently anonymized.</li>
            <li>Your service requests and incident reports remain on file but are unlinked from your name.</li>
            <li>You will be signed out immediately and cannot undo this.</li>
          </ul>
        </div>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-red-600 focus:ring-red-500"
          />
          <span>I understand this action is permanent and cannot be undone.</span>
        </label>

        <button
          type="button"
          disabled={!acknowledged}
          onClick={() => setStep('password')}
          className="w-full rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
          Continue
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleDelete} className="space-y-5">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Enter your password to confirm you want to permanently delete your account.
      </p>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Password</span>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            autoComplete="current-password"
            autoFocus
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 pr-10 text-sm outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-800"
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setShowPassword((v) => !v)}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
        {error ? <p className="mt-1 text-xs text-red-500">{error}</p> : null}
      </label>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setStep('confirm')}
          className="flex-1 rounded-full border border-zinc-300 py-3 text-sm font-semibold transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
          Back
        </button>
        <button
          type="submit"
          disabled={submitting || !password}
          className="flex-1 rounded-full bg-red-600 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50">
          {submitting ? 'Deleting…' : 'Delete Account'}
        </button>
      </div>
    </form>
  );
}
