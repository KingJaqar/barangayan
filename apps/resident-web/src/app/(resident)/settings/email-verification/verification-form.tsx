'use client';

import { residentEmailVerification } from '@barangayan/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function EmailVerificationForm({ userId, email, profileEmail, initialStatus }: { userId: string; email: string; profileEmail: string | null; initialStatus: string }) {
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
    if (action === 'send') { setDeadline(Date.now() + 60000); setClock(Date.now()); setCode(''); }
    try {
      const result = await residentEmailVerification(client, userId, action, code);
      if (!active.current) return;
      setStatus(result);
      if (result === 'verified') { setCode(''); setMessage('Your email is verified.'); router.refresh(); }
      else setMessage('Code sent. Enter the six-digit code from your email. It expires after one hour.');
    } catch (error) { if (active.current) setMessage(error instanceof Error ? error.message : 'Unable to verify your email. Retry.'); }
    finally { busy.current = false; if (active.current) setLoading(false); }
  }
  return <div className="space-y-4 rounded-xl border border-border bg-card p-5">
    <p className="break-all font-medium">{email}</p>
    {!matches ? <p role="alert">Save your sign-in email in Profile before verifying it.</p> : status === 'verified' ?
      <p role="status">Your email is verified.</p> : <>
        <p className="text-sm text-muted-foreground">We will send a code to your sign-in email. Verification keeps your account and password unchanged.</p>
        {status === 'pending' && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void run('verify'); }}>
          <label htmlFor="resident-email-code" className="block text-sm font-medium">Email code</label>
          <input id="resident-email-code" value={code} onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={loading} required
            className="w-full rounded-lg border border-input bg-background px-3 py-2" />
          <Button type="submit" disabled={loading || code.length !== 6}>{loading ? 'Checking…' : 'Verify email'}</Button>
        </form>}
        <Button type="button" variant="outline" disabled={loading || seconds > 0} onClick={() => { void run('send'); }}>
          {seconds > 0 ? `Resend in ${seconds}s` : status === 'pending' ? 'Resend code' : 'Send email code'}
        </Button>
      </>}
    {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
    <Link href="/settings/profile" className="block text-sm underline">Back to Profile</Link>
  </div>;
}
