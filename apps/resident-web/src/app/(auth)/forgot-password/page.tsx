'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AUTH_MESSAGES, authFailureKind } from '@/lib/auth/auth-feedback';
import { beginAttempt, notify } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

/**
 * Ported from apps/resident-android-mobile/src/app/(auth)/forgot-password.tsx — same
 * resetPasswordForEmail() call (not signInWithOtp — that sends Supabase's magic-link
 * template; this Supabase project's mailer_templates_recovery_content template is
 * customized to send a 6-digit code instead), paired with verify-otp's verifyOtp().
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);

  async function handleSend(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setError(null);
    setLoading(true);
    const attempt = beginAttempt('send-reset-code');

    let resetError: unknown = null;
    try {
      ({ error: resetError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email));
    } catch (cause) {
      resetError = cause;
    }

    if (resetError) {
      busy.current = false;
      setLoading(false);
      const kind = authFailureKind(resetError);
      if (kind === 'connection') {
        // The request may have reached Auth before the connection dropped.
        setError("We couldn't confirm that a reset code was sent. Check your email first; if nothing arrives in a few minutes, try again.");
        notify.warning("Couldn't confirm the code was sent", { id: attempt, description: 'Check your email before requesting another code.' });
      } else if (kind === 'rate-limit') {
        setError('Too many code requests. Please wait a few minutes before requesting another code.');
        notify.error("Couldn't send reset code", { id: attempt, description: 'Too many requests. Wait a few minutes.' });
      } else if (kind === 'service') {
        setError(AUTH_MESSAGES.service);
        notify.error("Couldn't send reset code", { id: attempt, description: 'Try again shortly.' });
      } else {
        setError("We couldn't send a reset code. Check the email address, then try again.");
        notify.error("Couldn't send reset code", { id: attempt, description: 'Check the email address.' });
      }
      return;
    }

    notify.success('If this email has an account, a reset code has been sent.', { id: attempt });
    // Stay pending until the code-entry destination replaces this screen.
    router.push(`/verify-otp?email=${encodeURIComponent(email)}`);
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={handleSend} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <Link href="/login" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
          ← Back to Login
        </Link>

        <h1 className="mb-1 text-center text-2xl font-bold text-primary">Forgot Password</h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Enter your email and we&apos;ll send you a code to reset your password.
        </p>

        <div className="mb-4 flex flex-col gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <Button type="submit" size="lg" loading={loading} loadingLabel="Sending code…" className="w-full">
          Send Reset Code
        </Button>
      </form>
    </div>
  );
}
