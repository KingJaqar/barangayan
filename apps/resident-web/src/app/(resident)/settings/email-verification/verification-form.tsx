'use client';

import { residentEmailVerification } from '@barangayan/shared';
import { CircleAlert, CircleCheck, Mail, MailCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { ChangeEmailForm } from './change-email-form';
import { syncResidentSignInEmail } from './actions';
import { beginAttempt, notify } from '@/lib/notify';

export function EmailVerificationForm({ userId, email, profileEmail, initialStatus, pendingEmail = '', changeEmail = false }: { userId: string; email: string; profileEmail: string | null; initialStatus: string; pendingEmail?: string; changeEmail?: boolean }) {
  const router = useRouter();
  const [client] = useState(createSupabaseBrowserClient);
  const [status, setStatus] = useState(initialStatus);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [clock, setClock] = useState(() => Date.now());
  const active = useRef(true), busy = useRef(false);
  const seconds = Math.max(0, Math.ceil((deadline - clock) / 1000));
  const matches = !!email && profileEmail?.trim().toLowerCase() === email.trim().toLowerCase();
  const verified = matches && status === 'verified';
  const StatusIcon = verified ? CircleCheck : !matches ? CircleAlert : MailCheck;
  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) { active.current = false; setCode(''); setMessage('Your session changed. Sign in again to verify your email.'); router.refresh(); }
    });
    return () => { active.current = false; clearInterval(timer); data.subscription.unsubscribe(); };
  }, [client, router, userId]);
  async function run(action: 'send' | 'verify') {
    if (busy.current || !active.current || !matches || (action === 'send' && deadline > Date.now())) return;
    busy.current = true; setLoading(true); setMessage(null);
    const attempt = beginAttempt(`email-${action}`);
    if (action === 'send') { setDeadline(Date.now() + 60000); setClock(Date.now()); setCode(''); }
    try {
      const result = await residentEmailVerification(client, userId, action, code);
      if (!active.current) return;
      setStatus(result);
      if (result === 'verified') notify.success('Email verified.', { id: attempt });
      else if (action === 'send') notify.success('Verification code sent. Check your email.', { id: attempt });
      else notify.info('Your email is still awaiting verification.', { id: attempt });
      if (result === 'verified') { setCode(''); setMessage('Your email is verified.'); router.refresh(); }
      else setMessage('Code sent. Enter the six-digit code from your email. It expires after one hour.');
    } catch (error) {
      if (active.current) {
        const message = error instanceof Error ? error.message : 'Unable to verify your email. Retry.';
        setMessage(message);
        // The shared helper supplies these controlled messages, but erases transport metadata.
        const knownRejection = ['This code is invalid or expired. Request a new code.', 'Sign in again to verify your email.', 'This account cannot verify a resident email.', 'Your profile email must match your sign-in email. Reload Profile and check it before retrying.', 'Please wait before trying again.', 'Your session changed. Sign in again to verify your email.', 'Enter the six-digit email code.'].includes(message);
        if (action === 'send' && !knownRejection) notify.warning("We couldn't confirm the code was sent. Check your email before trying again.", { id: attempt });
        else notify.error(message === 'This code is invalid or expired. Request a new code.' ? 'Code not accepted. Check the code or request a new one.' : action === 'send' ? "Couldn't send the verification code. Please try again." : "Couldn't verify your email. Please try again.", { id: attempt, description: knownRejection ? message : undefined });
      }
    }
    finally { busy.current = false; if (active.current) setLoading(false); }
  }
  async function syncEmail() {
    if (busy.current || !active.current) return;
    busy.current = true; setLoading(true); setMessage(null);
    const attempt = beginAttempt('sync-profile-email');
    try {
      const result = await syncResidentSignInEmail(userId);
      if (!active.current) return;
      if (!result.ok) { setMessage(result.message); notify.error("Couldn't update your profile email. Please try again.", { id: attempt }); }
      else { notify.success('Profile email updated to your sign-in email.', { id: attempt }); router.refresh(); }
    } catch { if (active.current) { setMessage('Unable to update your email details. Try again.'); notify.error("Couldn't update your profile email. Please try again.", { id: attempt }); } }
    finally { busy.current = false; if (active.current) setLoading(false); }
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <div className={`flex size-14 shrink-0 items-center justify-center rounded-2xl ${verified
            ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400'
            : 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400'}`}>
            <StatusIcon aria-hidden="true" className="size-7" strokeWidth={1.75} />
          </div>
          <div className="min-w-0 space-y-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${verified
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'}`}>
              {verified ? 'Verified' : !matches ? 'Action needed' : status === 'pending' ? 'Awaiting verification' : 'Not verified'}
            </span>
            <h2 className="text-lg font-semibold tracking-tight">
              {verified ? 'Your email is verified' : !matches ? 'Sync your email details' : status === 'pending' ? 'Check your inbox' : 'Verify your email address'}
            </h2>
            <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {verified ? 'You’re all set. This email address is confirmed for your Barangayan account.'
                : !matches ? 'Update your profile to use your current sign-in email, then verify the address here.'
                : status === 'pending' ? 'Enter the six-digit code sent to your email. The code expires after one hour.'
                : 'We’ll send a six-digit code to the email address below to confirm it belongs to you.'}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4">
          <Mail aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-zinc-600 dark:text-zinc-400" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Sign-in email</p>
            <p className="mt-1 break-all text-sm font-semibold">{email || 'No sign-in email available'}</p>
          </div>
        </div>

        {!matches ? <Button type="button" variant="outline" disabled={loading} onClick={() => void syncEmail()}>{loading ? 'Updating…' : 'Use current sign-in email'}</Button> : null}
        {matches && !verified ? (
          <div className="space-y-4">
            {status === 'pending' ? (
              <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run('verify'); }}>
                <label htmlFor="resident-email-code" className="block text-sm font-medium">Verification code</label>
                <input id="resident-email-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                  type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={loading} required
                  pattern="[0-9]{6}" placeholder="000000" aria-describedby="resident-email-code-hint"
                  className="h-14 w-full rounded-xl border border-input bg-background px-4 text-center text-xl font-semibold tracking-[0.35em] outline-none placeholder:text-muted-foreground/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
                <p id="resident-email-code-hint" className="text-xs text-zinc-600 dark:text-zinc-400">Enter all 6 digits from your email.</p>
                <Button type="submit" className="w-full" disabled={loading || code.length !== 6}>{loading ? 'Checking…' : 'Verify email'}</Button>
              </form>
            ) : null}
            <Button type="button" variant={status === 'pending' ? 'outline' : 'default'} className="w-full" disabled={loading || seconds > 0} onClick={() => { void run('send'); }}>
              {loading && status !== 'pending' ? 'Sending code…' : seconds > 0 ? `Resend in ${seconds}s` : status === 'pending' ? 'Resend code' : 'Send verification code'}
            </Button>
            <p className="text-center text-xs leading-5 text-zinc-600 dark:text-zinc-400">Verification keeps your account and password unchanged.</p>
          </div>
        ) : null}
        {message ? <p className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-6">{message}</p> : null}
      </div>
      <ChangeEmailForm userId={userId} email={email} initialPendingEmail={pendingEmail} initiallyOpen={changeEmail && !pendingEmail} disabled={loading} />
    </div>
  );
}
