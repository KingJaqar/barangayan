'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useToast } from '@/components/ui/toast';

// Mirrors the mobile app's (auth)/forgot-password.tsx exactly — same
// resetPasswordForEmail() call, same 6-digit-code recovery flow (this Supabase
// project's email template sends a code, not a magic link), just the web admin's own
// entry point since (admin)/login/page.tsx never had one.
export default function ForgotPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      toast.showError(`Could not send reset code: ${resetError.message}`);
      return;
    }

    toast.showSuccess('Reset code sent — check your email.');
    router.push(`/reset-password?email=${encodeURIComponent(email)}`);
  }

  const inputClass =
    'w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800';

  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 dark:bg-black">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-black/10 bg-white p-8 shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <Link
          href="/login"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-[var(--accent)]">
          ← Back to Login
        </Link>

        <h1 className="mb-1 text-center text-2xl font-bold text-[var(--accent)]">Forgot Password</h1>
        <p className="mb-6 text-center text-sm text-zinc-500">We&apos;ll send you a code to reset your password.</p>

        <label className="mb-4 block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </label>

        {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-[var(--accent)] py-2.5 text-sm font-semibold text-white disabled:opacity-50">
          {loading ? 'Sending…' : 'Send Reset Code'}
        </button>
      </form>
    </div>
  );
}
