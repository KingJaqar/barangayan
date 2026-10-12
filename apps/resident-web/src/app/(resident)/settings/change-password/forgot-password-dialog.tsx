'use client';

import Link from 'next/link';
import { SETTINGS_RECOVERY_PASSWORD_HINT, settingsRecoveryPasswordSchema } from '@/lib/auth/settings-recovery-password';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/ui/password-input';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { signOutBrowser } from '@/lib/auth/sign-out';
import { maskRecoveryEmail, type SettingsRecoveryFailure, type SettingsRecoveryResult } from '@/lib/auth/settings-recovery-contract';

type RecoveryStage = 'send' | 'code' | 'password' | 'success';
type Props = {
  userId: string; email: string; unavailable?: SettingsRecoveryFailure;
  checkEligibility: () => Promise<SettingsRecoveryResult>;
  sendCode: () => Promise<SettingsRecoveryResult>;
  resendCode: () => Promise<SettingsRecoveryResult>;
  verifyCode: (code: string) => Promise<SettingsRecoveryResult>;
  updatePassword: (password: string, confirmPassword: string) => Promise<SettingsRecoveryResult>;
  finish: () => Promise<void>;
};

export function ForgotPasswordDialog({ userId, email, unavailable, checkEligibility, sendCode, resendCode, verifyCode, updatePassword, finish }: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<RecoveryStage>('send');
  const [error, setError] = useState<SettingsRecoveryFailure | null>(null);
  const [eligibility, setEligibility] = useState<SettingsRecoveryResult>(unavailable ?? { ok: true });
  const [checking, checkTransition] = useTransition();
  const [pending, startTransition] = useTransition();
  const [operation, setOperation] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [accountChanged, setAccountChanged] = useState(false);
  const busy = useRef(false), active = useRef(true), signingOut = useRef(false), checkSequence = useRef(0);
  useEffect(() => {
    active.current = true;
    const { data } = createSupabaseBrowserClient().auth.onAuthStateChange((_event, session) => {
      if (!signingOut.current && (session?.user.id !== userId || session.user.email !== email)) {
        active.current = false;
        setAccountChanged(true);
        setCode(''); setPassword(''); setConfirmPassword('');
        setError({ ok: false, kind: 'session', message: 'Your account changed. Reload Change Password before continuing recovery.' });
      }
    });
    return () => { active.current = false; data.subscription.unsubscribe(); };
  }, [userId, email]);
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setSecondsLeft(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft]);

  function refreshEligibility() {
    const sequence = ++checkSequence.current;
    checkTransition(async () => {
      try {
        const result = await checkEligibility();
        if (active.current && sequence === checkSequence.current) { setEligibility(result); setError(null); }
      } catch {
        if (active.current && sequence === checkSequence.current) setEligibility({ ok: false, kind: 'connection', message: 'Unable to check your verified email. Check your connection, then try again.' });
      }
    });
  }
  function changeOpen(value: boolean) {
    if (busy.current) return;
    setOpen(value);
    setCode(''); setPassword(''); setConfirmPassword(''); setFieldErrors({});
    if (value && stage === 'send') refreshEligibility();
  }
  function run(action: 'send' | 'resend' | 'verify' | 'update') {
    if (busy.current || !active.current || checking || (action === 'send' && !eligibility.ok) || (action === 'resend' && secondsLeft > 0)) return;
    if (action === 'update') {
      const result = settingsRecoveryPasswordSchema.safeParse({ password, confirmPassword });
      if (!result.success) {
        const errors: Record<string, string> = {};
        for (const issue of result.error.issues) errors[String(issue.path[0])] = issue.message;
        setFieldErrors(errors);
        document.getElementById(errors.password ? 'recovery-password' : 'recovery-confirm-password')?.focus();
        return;
      }
    }
    busy.current = true; setOperation(action); setError(null); setFieldErrors({});
    startTransition(async () => {
      try {
        const result = action === 'send' ? await sendCode() : action === 'resend' ? await resendCode() : action === 'verify' ? await verifyCode(code) : await updatePassword(password, confirmPassword);
        if (!active.current) return;
        if (!result.ok) {
          setError(result);
          if (stage === 'send' && ['session', 'unverified', 'mismatch'].includes(result.kind)) setEligibility(result);
          if (action === 'resend') setSecondsLeft(45);
          return;
        }
        if (action === 'send' || action === 'resend') { setStage('code'); setCode(''); setSecondsLeft(45); }
        else if (action === 'verify') { setStage('password'); setCode(''); }
        else { setStage('success'); setPassword(''); setConfirmPassword(''); }
      } catch {
        if (active.current) setError({ ok: false, kind: 'connection', message: action === 'send' || action === 'resend' ? "We couldn't confirm that a code was sent. Check your email before trying again." : action === 'update' ? "We couldn't confirm that your password was changed. Check your connection, then try again." : 'Unable to verify the code. Check your connection and try again.' });
      } finally { busy.current = false; }
    });
  }
  function continueToLogin() {
    if (busy.current || accountChanged) return;
    busy.current = true; signingOut.current = true; setOperation('finish'); setError(null);
    startTransition(async () => {
      try {
        const outcome = await signOutBrowser('local');
        if (outcome === 'failed') {
          signingOut.current = false;
          setError({ ok: false, kind: 'connection', message: 'Your password was updated, but we could not sign you out. Try again.' });
          return;
        }
        await finish();
      } catch {
        setError({ ok: false, kind: 'connection', message: 'Your password was updated. We could not open Login. Please try again.' });
      } finally { busy.current = false; }
    });
  }
  const message = error ?? (stage === 'send' && !eligibility.ok ? eligibility : null);
  const needsVerification = stage === 'send' && !eligibility.ok && eligibility.kind === 'unverified';
  const blocked = pending || checking || accountChanged || error?.kind === 'session';
  const title = needsVerification ? 'Email not verified' : stage === 'code' ? 'Enter reset code' : stage === 'password' ? 'Choose a new password' : stage === 'success' ? 'Password updated' : 'Reset your password';
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><button type="button" className="text-sm font-medium text-[var(--accent)] hover:underline">Forgot password?</button></DialogTrigger>
    <DialogContent showCloseButton={!pending} className="max-h-[90dvh] overflow-y-auto" onOpenAutoFocus={event => { event.preventDefault(); document.getElementById(stage === 'code' ? 'recovery-code' : stage === 'password' ? 'recovery-password' : 'recovery-primary')?.focus(); }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>
        {needsVerification ? 'Verify your email first, then return here to reset your password.' : stage === 'code' ? <>Enter the six-digit code sent to {maskRecoveryEmail(email)}.</> : stage === 'password' ? 'Your email code is verified. Choose a new password using the requirements below.' : stage === 'success' ? 'Your password was updated successfully. Continue to login and sign in with your new password.' : <>We will send a six-digit reset code to {maskRecoveryEmail(email)}. Verify the code here to choose a new password without your current password.</>}
      </DialogDescription>
      {message ? <p role="alert" className="text-sm text-destructive">{message.message} {message.href && message.kind !== 'unverified' ? <Link href={message.href} className="underline">{message.href === '/settings/profile' ? 'Open Profile' : message.href === '/login' ? 'Open Login' : 'Back to Change Password'}</Link> : null}</p> : null}
      {stage !== 'send' && stage !== 'success' && message && ['session', 'unverified', 'mismatch'].includes(message.kind) && !accountChanged ? <Button type="button" variant="outline" disabled={pending} onClick={() => { setStage('send'); setCode(''); setPassword(''); setConfirmPassword(''); setError(null); refreshEligibility(); }}>Start again</Button> : null}
      {stage === 'send' ? <>
        {!eligibility.ok ? <Button type="button" variant="outline" loading={checking} loadingLabel="Checking email…" onClick={refreshEligibility}>Check again</Button> : null}
        {needsVerification ? <Button asChild><Link href="/settings/email-verification">Verify email</Link></Button> : <Button id="recovery-primary" type="button" loading={pending || checking} loadingLabel={checking ? 'Checking email…' : 'Sending code…'} disabled={!eligibility.ok || error?.kind === 'session'} onClick={() => run('send')}>Send reset code</Button>}
      </> : stage === 'success' ? <Button id="recovery-primary" type="button" loading={pending} loadingLabel="Opening login…" disabled={accountChanged} onClick={continueToLogin}>Continue to login</Button> : <form className="space-y-4" onSubmit={event => { event.preventDefault(); event.stopPropagation(); run(stage === 'code' ? 'verify' : 'update'); }}>
        {stage === 'code' ? <>
          <Label htmlFor="recovery-code">Six-digit reset code</Label>
          <Input id="recovery-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={blocked} required />
          <Button type="submit" className="w-full" loading={pending && operation === 'verify'} loadingLabel="Verifying…" disabled={blocked || code.length !== 6}>Verify code</Button>
          <Button type="button" variant="outline" className="w-full" loading={pending && operation === 'resend'} loadingLabel="Sending code…" disabled={blocked || secondsLeft > 0} onClick={() => run('resend')}>{secondsLeft > 0 ? 'Resend code in ' + secondsLeft + 's' : 'Resend code'}</Button>
        </> : <>
          <div className="space-y-1.5"><Label htmlFor="recovery-password">New Password</Label><PasswordInput id="recovery-password" autoFocus autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} disabled={blocked} required aria-invalid={!!fieldErrors.password} aria-describedby={fieldErrors.password ? 'recovery-password-hint recovery-password-error' : 'recovery-password-hint'} /><p id="recovery-password-hint" className="text-xs text-muted-foreground">{SETTINGS_RECOVERY_PASSWORD_HINT}</p>{fieldErrors.password ? <p id="recovery-password-error" className="text-xs text-destructive">{fieldErrors.password}</p> : null}</div>
          <div className="space-y-1.5"><Label htmlFor="recovery-confirm-password">Confirm New Password</Label><PasswordInput id="recovery-confirm-password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} disabled={blocked} required aria-invalid={!!fieldErrors.confirmPassword} aria-describedby={fieldErrors.confirmPassword ? 'recovery-confirm-error' : undefined} />{fieldErrors.confirmPassword ? <p id="recovery-confirm-error" className="text-xs text-destructive">{fieldErrors.confirmPassword}</p> : null}</div>
          <Button type="submit" className="w-full" loading={pending} loadingLabel="Updating password…" disabled={blocked}>Update password</Button>
        </>}
      </form>}
    </DialogContent>
  </Dialog>;
}
