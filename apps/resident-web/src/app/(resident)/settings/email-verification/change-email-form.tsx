'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { requestResidentEmailChange } from '@/lib/auth/email-change';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { syncResidentSignInEmail } from './actions';

export function ChangeEmailForm({ userId, email, initialPendingEmail, initiallyOpen, disabled }: {
  userId: string; email: string; initialPendingEmail: string; initiallyOpen: boolean; disabled: boolean;
}) {
  const router = useRouter();
  const [client] = useState(createSupabaseBrowserClient);
  const [open, setOpen] = useState(initiallyOpen);
  const [newEmail, setNewEmail] = useState('');
  const [pendingEmail, setPendingEmail] = useState(initialPendingEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState<'send' | 'check' | null>(null);
  const [seconds, setSeconds] = useState(0);
  const busy = useRef(false);
  const active = useRef(true);
  const blocked = disabled || working !== null;

  useEffect(() => {
    active.current = true;
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== userId) {
        active.current = false;
        setOpen(false); setNewEmail(''); setPendingEmail('');
        router.refresh();
      }
    });
    return () => { active.current = false; data.subscription.unsubscribe(); };
  }, [client, router, userId]);
  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  async function send(address: string) {
    if (busy.current || !active.current || disabled || seconds > 0) return;
    busy.current = true; setWorking('send'); setMessage(null);
    try {
      const requested = await requestResidentEmailChange(client, userId, email, address, window.location.origin);
      if (!active.current) return;
      setPendingEmail(requested); setOpen(false); setNewEmail(''); setSeconds(60);
      setMessage('Confirmation instructions sent. Check your inbox and spam folder.');
    } catch (error) {
      if (active.current) setMessage(error instanceof Error ? error.message : 'Unable to request an email change. Try again.');
    } finally { busy.current = false; if (active.current) setWorking(null); }
  }

  async function checkConfirmation() {
    if (busy.current || !active.current || disabled) return;
    busy.current = true; setWorking('check'); setMessage(null);
    try {
      const result = await syncResidentSignInEmail(userId);
      if (!active.current) return;
      if (!result.ok) { setMessage(result.message); return; }
      if (result.pendingEmail) {
        setPendingEmail(result.pendingEmail);
        setMessage('Your email change is still awaiting confirmation. Complete the instructions in both inboxes if requested.');
      } else if (result.email.toLowerCase() === pendingEmail.toLowerCase()) {
        setPendingEmail('');
        setMessage('Email address changed. You can now verify the new address.');
        router.refresh();
      } else {
        setMessage('No completed email change was found. Request a new confirmation email.');
      }
    } catch { if (active.current) setMessage('Unable to check confirmation. Try again.'); }
    finally { busy.current = false; if (active.current) setWorking(null); }
  }

  return (
    <div className="space-y-4 border-t border-border bg-muted/20 p-6 sm:px-8" aria-busy={working !== null || undefined}>
      <div>
        <h3 className="text-sm font-semibold">Change email address</h3>
        <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Use a different email address for your account and sign-in.</p>
      </div>
      {open ? (
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); void send(newEmail); }}>
          <label htmlFor="new-resident-email" className="block text-sm font-medium">New email address</label>
          <input id="new-resident-email" type="email" autoComplete="email" required maxLength={254}
            value={newEmail} onChange={event => setNewEmail(event.target.value)} disabled={blocked}
            placeholder="you@example.com"
            className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50" />
          <p className="text-xs leading-5 text-zinc-600 dark:text-zinc-400">Your current email stays active until the change is confirmed.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={blocked || seconds > 0 || !newEmail.trim()}>
              {working === 'send' ? 'Sending…' : seconds > 0 ? `Try again in ${seconds}s` : 'Send confirmation email'}
            </Button>
            <Button type="button" variant="ghost" disabled={blocked} onClick={() => { setOpen(false); setNewEmail(''); setMessage(null); }}>Cancel</Button>
          </div>
        </form>
      ) : pendingEmail ? (
        <div className="space-y-3">
          <p className="break-all text-sm"><span className="font-medium">Requested email:</span> {pendingEmail}</p>
          <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">Follow the confirmation instructions sent to your new email address. You may also need to confirm the change in your current inbox. Then check confirmation here.</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={blocked} onClick={() => void checkConfirmation()}>{working === 'check' ? 'Checking…' : 'Check confirmation'}</Button>
            <Button type="button" variant="outline" disabled={blocked || seconds > 0} onClick={() => void send(pendingEmail)}>
              {working === 'send' ? 'Sending…' : seconds > 0 ? `Resend in ${seconds}s` : 'Resend confirmation'}
            </Button>
            <Button type="button" variant="ghost" disabled={blocked} onClick={() => { setOpen(true); setMessage(null); }}>Choose another email</Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" disabled={blocked} onClick={() => { setOpen(true); setMessage(null); }}>
          <Pencil aria-hidden="true" className="size-4" />Change email address
        </Button>
      )}
      {message ? <p role="status" className="text-sm leading-6">{message}</p> : null}
    </div>
  );
}
