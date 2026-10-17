'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AUTH_MESSAGES, authFailureKind } from '@/lib/auth/auth-feedback';
import { beginAttempt, eventId, notify, setNotificationSession } from '@/lib/notify';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { startTransition } from 'react';
import type { SettingsRecoveryOwner, SettingsRecoveryResult } from '@/lib/auth/settings-recovery-contract';

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
function VerifyOtpForm({ settings }: { settings?: SettingsCodeRecovery }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = settings?.owner.email ?? searchParams.get('email') ?? '';

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_COOLDOWN_SECONDS);
  // Synchronous guards against a double Enter/click before the disabled state renders.
  const verifying = useRef(false);
  const resendBusy = useRef(false);
  const active = useRef(true);
  const [accountChanged, setAccountChanged] = useState(false);
  useEffect(() => {
    active.current = true;
    const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((event, session) => {
      const changed = settings
        ? session?.user.id !== settings.owner.userId || session.user.email !== settings.owner.email
        : (session && session.user.email?.trim().toLowerCase() !== email.trim().toLowerCase()) || event === 'SIGNED_OUT';
      if (changed) {
        active.current = false; setAccountChanged(true); setCode('');
      }
    });
    return () => { active.current = false; data.subscription.unsubscribe(); };
  }, [settings, email]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (verifying.current || resendBusy.current || accountChanged) return;
    verifying.current = true;
    setError(null);
    setLoading(true);
    const attempt = beginAttempt('verify-reset-code');

    let verifyError: unknown = null;
    try {
      if (settings) {
        const result = await settings.verify(code);
        if (!active.current) { verifying.current = false; return; }
        if (!result.ok) {
          setError(result.message);
          notify.error(result.kind === 'rejected' ? 'Code not accepted. Check the code or request a new one.' : result.kind === 'connection' ? "Couldn't verify the code. Check your connection and try again." : "Couldn't verify the code. Review the message below.", { id: attempt, description: result.message });
          if (result.kind === 'session') setAccountChanged(true);
          verifying.current = false; setLoading(false);
          return;
        }
        notify.success('Code verified. Choose your new password.', { id: attempt });
        router.replace('/reset-password?source=settings');
        return;
      }
      const result = await createSupabaseBrowserClient().auth.verifyOtp({ type: 'recovery', email, token: code });
      verifyError = result.error;
      if (active.current && !result.error && result.data.user) {
        setNotificationSession(result.data.user.id);
        notify.success('Code verified. Choose your new password.', { id: eventId('recovery-code', attempt) });
      }
    } catch (cause) {
      if (isRedirectError(cause)) {
        if (active.current) notify.success('Code verified. Choose your new password.', { id: attempt });
        throw cause;
      }
      verifyError = cause;
    }
    if (!active.current) { verifying.current = false; return; }

    if (verifyError) {
      verifying.current = false;
      setLoading(false);
      const kind = authFailureKind(verifyError);
      if (kind === 'connection') {
        setError(AUTH_MESSAGES.connection);
        notify.error("Couldn't verify the code", { id: attempt, description: 'Check your connection, then try again.' });
      } else if (kind === 'rate-limit') {
        setError(AUTH_MESSAGES.rateLimit);
        notify.error("Couldn't verify the code", { id: attempt, description: 'Too many attempts. Wait a moment.' });
      } else if (kind === 'service') {
        setError(AUTH_MESSAGES.service);
        notify.error("Couldn't verify the code", { id: attempt, description: 'Try again shortly.' });
      } else {
        setError('That code is invalid or has expired. Check the code, or request a new one.');
        notify.error('Code not accepted', { id: attempt, description: 'Check the code or request a new one.' });
      }
      return;
    }

    // Stay pending until the reset screen replaces this one.
    router.replace('/reset-password');
  }

  async function handleResend() {
    if (resendBusy.current || verifying.current || secondsLeft > 0 || accountChanged) return;
    resendBusy.current = true;
    setError(null);
    setResending(true);
    const attempt = beginAttempt('resend-reset-code');

    let resendError: unknown = null;
    try {
      if (settings) {
        const result = await settings.resend();
        if (!active.current) { resendBusy.current = false; return; }
        resendBusy.current = false; setResending(false);
        setSecondsLeft(RESEND_COOLDOWN_SECONDS);
        if (!result.ok) {
          setError(result.message);
          if (result.kind === 'connection') notify.warning("We couldn't confirm a new code was sent. Check your email first.", { id: attempt });
          else notify.error("Couldn't send a new code. Please try again.", { id: attempt, description: result.message });
          if (result.kind === 'session') setAccountChanged(true);
        } else {
          setCode('');
          notify.success('New code sent', { id: attempt, description: 'Check your email for the latest code.' });
        }
        return;
      }
      ({ error: resendError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(email));
    } catch (cause) {
      resendError = cause;
    }
    resendBusy.current = false;
    if (!active.current) return;
    setResending(false);

    if (resendError) {
      const kind = authFailureKind(resendError);
      if (kind === 'connection') {
        // The request may have reached Auth; the cooldown is left alone so a deliberate
        // retry stays possible.
        setError("We couldn't confirm that a new code was sent. Check your email before requesting another one.");
        notify.warning("Couldn't confirm a new code was sent", { id: attempt, description: 'Check your email first.' });
      } else if (kind === 'rate-limit') {
        setError('Too many code requests. Please wait a few minutes before requesting another code.');
        notify.error("Couldn't send a new code", { id: attempt, description: 'Too many requests. Wait a few minutes.' });
      } else {
        setError(kind === 'service' ? AUTH_MESSAGES.service : "We couldn't send a new code. Go back and check the email address.");
        notify.error("Couldn't send a new code", { id: attempt, description: kind === 'service' ? 'Try again shortly.' : 'Check the email address.' });
      }
      return;
    }

    notify.success('New code sent', { id: attempt, description: 'Check your email for the latest code.' });
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }

  const maskedEmail = email.replace(/^(.{2}).*(@.*)$/, '$1••••$2');

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={event => { event.preventDefault(); startTransition(() => handleVerify(event)); }} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        {settings ? <Link href="/settings/change-password" className="mb-4 block text-sm text-muted-foreground hover:underline">← Back to Change Password</Link> : null}
        <h1 className="mb-1 text-2xl font-bold text-primary">Enter Reset Code</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          We&apos;ve sent a 6-digit code to
          <br />
          {maskedEmail || 'your email'}
        </p>

        <Input
          aria-label="6-digit reset code"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          required
          disabled={accountChanged}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          placeholder="000000"
          className="mb-4 text-center text-lg tracking-[0.5em]"
        />

        {error || accountChanged ? <p role={accountChanged ? "alert" : undefined} className="mb-3 text-sm text-destructive">{accountChanged ? settings ? 'Your recovery session changed or ended. Return to Change Password and start again.' : 'Your recovery session changed or ended. Request a new reset code.' : error}</p> : null}

        <div className="mb-4 text-sm">
          {secondsLeft > 0 ? (
            <span className="text-muted-foreground">Resend code in 00:{String(secondsLeft).padStart(2, '0')}</span>
          ) : (
            <button
              type="button"
              onClick={() => startTransition(handleResend)}
              disabled={resending || loading || accountChanged}
              aria-busy={resending || undefined}
              className="font-semibold text-primary hover:underline disabled:opacity-50">
              {resending ? 'Resending…' : 'Resend Code'}
            </button>
          )}
        </div>

        <Button type="submit" size="lg" loading={loading} loadingLabel="Verifying…" disabled={code.length !== 6 || resending || accountChanged} className="w-full">
          Verify
        </Button>
      </form>
    </div>
  );
}

export type SettingsCodeRecovery = { owner: SettingsRecoveryOwner; verify: (code: string) => Promise<SettingsRecoveryResult>; resend: () => Promise<SettingsRecoveryResult> };

export default function VerifyOtpScreen({ settings }: { settings?: SettingsCodeRecovery }) {
  return (
    <Suspense>
      <VerifyOtpForm settings={settings} />
    </Suspense>
  );
}
