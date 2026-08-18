'use client';

import { newPasswordSchema } from '@barangayan/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { useToast } from '@/components/ui/toast';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const RESEND_COOLDOWN_SECONDS = 45;

// Mirrors the mobile app's (auth)/otp.tsx (type: 'recovery' branch) + (auth)/reset-
// password.tsx combined into one screen: enter the 6-digit code emailed by
// forgot-password/page.tsx, verifyOtp() establishes a recovery session, then
// updateUser() sets the new password in the same step. Resend button mirrors the
// mobile OTP screen's own cooldown pattern.
function ResetPasswordForm() {
  const router = useRouter();
  const toast = useToast();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const result = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    const supabase = createSupabaseBrowserClient();

    const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'recovery', email, token: code });
    if (verifyError) {
      setLoading(false);
      setError(verifyError.message);
      toast.showError(`Invalid or expired code: ${verifyError.message}`);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: result.data.password });
    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      toast.showError(`Could not update password: ${updateError.message}`);
      return;
    }

    toast.showSuccess('Password updated — please log in.');
    router.replace('/login');
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
    setResending(false);

    if (resendError) {
      setError(resendError.message);
      toast.showError(`Could not resend code: ${resendError.message}`);
      return;
    }

    toast.showSuccess('A new code has been sent.');
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <h1 className="mb-1 text-center text-2xl font-bold text-[var(--accent)]">Reset Password</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">
          Enter the 6-digit code sent to {email || 'your email'} and choose a new password.
        </p>

        <label className="mb-2 block text-sm">
          <span className="mb-1 block font-medium">Code</span>
          <input
            inputMode="numeric"
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} text-center text-lg tracking-[0.5em]`}
            placeholder="000000"
          />
        </label>

        <div className="mb-4 text-right text-xs">
          {secondsLeft > 0 ? (
            <span className="text-zinc-400">Resend code in 00:{String(secondsLeft).padStart(2, '0')}</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-[var(--accent)] hover:underline disabled:opacity-50">
              {resending ? 'Resending…' : 'Resend Code'}
            </button>
          )}
        </div>

        <label className="mb-3 block text-sm">
          <span className="mb-1 block font-medium">New Password</span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
          {fieldErrors.password ? <p className="mt-1 text-xs text-red-600">{fieldErrors.password}</p> : null}
        </label>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Confirm New Password</span>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={inputClass}
          />
          {fieldErrors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{fieldErrors.confirmPassword}</p> : null}
        </label>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Updating…' : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
