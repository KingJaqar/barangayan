'use client';

import { newPasswordSchema } from '@barangayan/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AUTH_MESSAGES, authErrorCode, authFailureKind, isBreachedPassword } from '@/lib/auth/auth-feedback';
import { beginAttempt, notify, type OperationId } from '@/lib/notify';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { signOutBrowser } from '@/lib/auth/sign-out';
import { notifyLoggedOut } from '@/lib/auth/session-feedback';
import { isRedirectError } from 'next/dist/client/components/redirect-error';
import type { SettingsRecoveryOwner, SettingsRecoveryResult } from '@/lib/auth/settings-recovery-contract';

/**
 * Ported from apps/resident-android-mobile/src/app/(auth)/reset-password.tsx — plain
 * updateUser({password}) against the recovery session verify-otp's verifyOtp()
 * established. On web the recovery session is already a real, valid login (unlike
 * mobile, there's no `setPasswordRecovery` gate to clear), so success routes straight
 * to /home rather than back through /login.
 */
export default function ResetPasswordForm({ settings }: { settings?: { owner: SettingsRecoveryOwner; update: (password: string, confirmPassword: string) => Promise<SettingsRecoveryResult>; finish: () => Promise<void> } }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  const active = useRef(true);
  const signingOut = useRef(false);
  const finishBusy = useRef(false);
  const [accountChanged, setAccountChanged] = useState(false);
  const [updated, setUpdated] = useState(false);
  const [signOutPending, startSignOut] = useTransition();
  useEffect(() => {
    active.current = true;
    if (!settings) return () => { active.current = false; };
    const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      if ((session || !signingOut.current) && (session?.user.id !== settings.owner.userId || session.user.email !== settings.owner.email)) {
        active.current = false; setAccountChanged(true); setPassword(''); setConfirmPassword('');
      }
    });
    return () => { active.current = false; data.subscription.unsubscribe(); };
  }, [settings]);

  async function finishSignOut(combined = false) {
    if (finishBusy.current || !active.current) return;
    finishBusy.current = true;
    const attempt = beginAttempt('recovery-logout');
    signingOut.current = true;
    let loggedOut = false;
    let logoutAttempt: OperationId | null = null;
    try {
      const outcome = await signOutBrowser('local');
      if (outcome === 'failed') {
        signingOut.current = false;
        if (active.current) setError('Your password was updated, but we could not sign you out. Please try signing out again.');
        notify.error("Your password was updated, but we couldn't log you out. Please try again.", { id: attempt });
        return;
      }
      loggedOut = true;
      logoutAttempt = notifyLoggedOut(null);
      if (settings) await settings.finish();
      notify.success(combined ? 'Password updated. Log in with your new password.' : 'Logged out.', { id: logoutAttempt, keepOnSessionChange: true });
    } catch (cause) {
      if (isRedirectError(cause)) {
        if (logoutAttempt) notify.success(combined ? 'Password updated. Log in with your new password.' : 'Logged out.', { id: logoutAttempt, keepOnSessionChange: true });
        throw cause;
      }
      if (logoutAttempt) notify.warning("You're logged out. Open Login to continue.", { id: logoutAttempt, keepOnSessionChange: true });
      if (active.current) setError(loggedOut ? 'Your password was updated and you are signed out. Please open Login to continue.' : 'Your password was updated, but we could not sign you out. Please try signing out again.');
      if (!loggedOut) notify.error("Your password was updated, but we couldn't log you out. Please try again.", { id: attempt });
    } finally { finishBusy.current = false; }
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || accountChanged || updated) return;
    setError(null);
    setSessionEnded(false);
    setFieldErrors({});

    const result = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        errors[String(issue.path[0])] = issue.message;
      }
      setFieldErrors(errors);
      notify.error('Check the password requirements and confirmation.', { id: beginAttempt('password-validation') });
      document.getElementById(errors.password ? 'password' : 'confirmPassword')?.focus();
      return;
    }

    busy.current = true;
    setLoading(true);
    const attempt = beginAttempt('reset-password');
    let updateError: unknown = null;
    try {
      if (settings) {
        const response = await settings.update(result.data.password, result.data.confirmPassword);
        if (!active.current) { busy.current = false; return; }
        if (!response.ok) {
          setError(response.message);
          if (response.kind === 'connection') notify.warning("We couldn't confirm the password change. Try logging in before resetting it again.", { id: attempt });
          else notify.error("Couldn't update your password. Please try again.", { id: attempt, description: response.message });
          if (response.kind === 'session') setAccountChanged(true);
          busy.current = false; setLoading(false);
          return;
        }
        setPassword(''); setConfirmPassword(''); setUpdated(true); setLoading(false);
        try { await finishSignOut(true); }
        finally { busy.current = false; }
        return;
      }
      ({ error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password: result.data.password }));
    } catch (cause) {
      if (isRedirectError(cause)) throw cause;
      updateError = cause;
    }
    if (!active.current) { busy.current = false; return; }

    if (updateError) {
      busy.current = false;
      setLoading(false);
      const kind = authFailureKind(updateError);
      const code = authErrorCode(updateError);
      if (kind === 'connection') {
        // The change may have been applied before the connection dropped.
        setError("We couldn't confirm the password change. Try logging in before resetting it again.");
        notify.warning("We couldn't confirm the password change. Try logging in before resetting it again.", { id: attempt });
      } else if (kind === 'session') {
        setSessionEnded(true);
        setError('Your reset session has ended. Request a new code to choose a password.');
        notify.error("Couldn't update password", { id: attempt, description: 'Your reset session has ended.' });
      } else if (kind === 'rate-limit' || kind === 'service') {
        setError(kind === 'rate-limit' ? AUTH_MESSAGES.rateLimit : AUTH_MESSAGES.service);
        notify.error("Couldn't update password", { id: attempt, description: 'Try again shortly.' });
      } else if (code === 'same_password') {
        setFieldErrors({ password: 'Choose a password different from your current one.' });
        document.getElementById('password')?.focus();
        notify.error("Couldn't update password", { id: attempt, description: 'Choose a different password.' });
      } else if (code === 'weak_password') {
        setFieldErrors({ password: isBreachedPassword(updateError) ? 'This password has appeared in a data breach. Choose a different one.' : 'Choose a stronger password.' });
        document.getElementById('password')?.focus();
        notify.error("Couldn't update password", { id: attempt, description: 'Choose a stronger password.' });
      } else {
        setError("We couldn't update your password. Please try again.");
        notify.error("Couldn't update password", { id: attempt, description: 'Please try again.' });
      }
      return;
    }

    // Same session and account, so this outcome stays visible on /home. Stay pending
    // until /home replaces this screen.
    notify.success('Password updated', { id: attempt });
    router.replace('/home');
    router.refresh();
  }

  return (
    <div className="flex min-h-full flex-1 items-center justify-center p-6">
      <form onSubmit={event => { event.preventDefault(); startSignOut(() => handleUpdate(event)); }} className="w-full max-w-sm rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-primary">Reset Password</h1>
        {updated ? <div className="space-y-4"><p>Password updated. Sign in with your new password.</p>{error ? <p className="text-sm text-destructive">{error}</p> : null}<Button type="button" loading={signOutPending} onClick={() => startSignOut(() => finishSignOut())}>Sign out and continue to login</Button></div> : <>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Please create a strong, secure new password for your account.
        </p>

        <div className="mb-3 flex flex-col gap-1.5">
          <Label htmlFor="password">New Password</Label>
          <Input
            id="password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? 'password-error' : undefined}
          />
          {fieldErrors.password ? <p id="password-error" className="text-xs text-destructive">{fieldErrors.password}</p> : null}
        </div>

        <div className="mb-4 flex flex-col gap-1.5">
          <Label htmlFor="confirmPassword">Confirm New Password</Label>
          <Input
            id="confirmPassword"
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            aria-invalid={!!fieldErrors.confirmPassword}
            aria-describedby={fieldErrors.confirmPassword ? 'confirmPassword-error' : undefined}
          />
          {fieldErrors.confirmPassword ? <p id="confirmPassword-error" className="text-xs text-destructive">{fieldErrors.confirmPassword}</p> : null}
        </div>

        {accountChanged ? <p role="alert" className="mb-3 text-sm text-destructive">Your recovery session changed or ended. <Link href="/settings/change-password" className="underline">Return to Change Password</Link> and start again.</p> : null}
        {error ? (
          <p className="mb-3 text-sm text-destructive">
            {error}
            {sessionEnded ? (
              <>
                {' '}
                <Link href={settings ? '/settings/change-password' : '/forgot-password'} className="font-medium underline">
                  Request a new code
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <Button type="submit" size="lg" loading={loading} loadingLabel="Updating…" disabled={accountChanged} className="w-full">
          Update Password
        </Button>
        </>}
      </form>
    </div>
  );
}
