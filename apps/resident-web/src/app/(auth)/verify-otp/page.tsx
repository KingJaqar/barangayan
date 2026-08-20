'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const RESEND_COOLDOWN_SECONDS = 45;

/**
 * Ported from apps/resident-android-mobile/src/app/(auth)/otp.tsx (the 'recovery'
 * branch — the signup branch was removed on mobile too, since Confirm Email is
 * disabled and signUp() returns a live session immediately). verifyOtp() establishes a
 * real (recovery) session, then hands off to /reset-password. Cooldown uses the same
 * plain decrementing-interval pattern as admin-web's reset-password.tsx and mobile's
 * otp.tsx (not useCountdown's Date.now()-based expiry) — a bare interval keeps this
 * clear of the newer react-hooks/purity lint rule around impure calls near setState.
 */
function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createSupabaseBrowserClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({ type: 'recovery', email, token: code });
    setLoading(false);

    if (verifyError) {
      setError(verifyError.message);
      toast.error(`Invalid or expired code: ${verifyError.message}`);
      return;
    }

    router.replace('/reset-password');
  }

  async function handleResend() {
    setError(null);
    setResending(true);
    const supabase = createSupabaseBrowserClient();
    const { error: resendError } = await supabase.auth.resetPasswordForEmail(email);
    setResending(false);

    if (resendError) {
      setError(resendError.message);
      toast.error(`Could not resend code: ${resendError.message}`);
      return;
    }

    toast.success('A new code has been sent.');
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  const maskedEmail = email.replace(/^(.{2}).*(@.*)$/, '$1••••$2');

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={handleVerify} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <h1 className="mb-1 text-2xl font-bold text-primary">Enter Reset Code</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          We&apos;ve sent a 6-digit code to
          <br />
          {maskedEmail || 'your email'}
        </p>

        <Input
          inputMode="numeric"
          maxLength={6}
          required
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="mb-4 text-center text-lg tracking-[0.5em]"
        />

        {error ? <p className="mb-3 text-sm text-destructive">{error}</p> : null}

        <div className="mb-4 text-sm">
          {secondsLeft > 0 ? (
            <span className="text-muted-foreground">Resend code in 00:{String(secondsLeft).padStart(2, '0')}</span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="font-semibold text-primary hover:underline disabled:opacity-50">
              {resending ? 'Resending…' : 'Resend Code'}
            </button>
          )}
        </div>

        <Button type="submit" size="lg" loading={loading} disabled={code.length !== 6} className="w-full">
          Verify
        </Button>
      </form>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpForm />
    </Suspense>
  );
}
