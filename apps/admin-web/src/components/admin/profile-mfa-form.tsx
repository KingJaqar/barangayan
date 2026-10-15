'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { createSupabaseBrowserClient } from '@/lib/supabase/client';

type ProfileAuth = ReturnType<typeof createSupabaseBrowserClient>['auth'];

export function ProfileMfaForm({ auth, onVerified, onBusy }: { auth: ProfileAuth; onVerified: () => void | Promise<void>; onBusy?: (busy: boolean) => void }) {
  const [factors, setFactors] = useState<{ id: string; name: string }[]>([]);
  const [factorId, setFactorId] = useState(''); const [code, setCode] = useState('');
  const [message, setMessage] = useState('Loading your authenticator options…');
  const [busy, setBusy] = useState(false); const submitting = useRef(false);
  const summary = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let mounted = true;
    void auth.mfa.listFactors().then(result => {
      if (!mounted) return;
      const available = result.data?.totp ?? [];
      if (result.error || available.length === 0) { setMessage('No supported authenticator is available. Contact your account administrator; verification has not completed.'); return; }
      setFactors(available.map(factor => ({ id: factor.id, name: factor.friendly_name || 'Authenticator app' })));
      setFactorId(available[0].id); setMessage('Enter the current code from your enrolled authenticator app.');
    }).catch(() => { if (mounted) setMessage('Authenticator options could not be loaded. Reload to check your current sign-in.'); });
    return () => { mounted = false; };
  }, [auth]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current) return;
    submitting.current = true; setBusy(true); onBusy?.(true);
    try {
      if (!factors.some(factor => factor.id === factorId) || !/^\d{6}$/.test(code)) throw new Error('Enter the six-digit code from your authenticator app.');
      const result = await auth.mfa.challengeAndVerify({ factorId, code }); setCode('');
      if (result.error) throw new Error('Authenticator verification failed. Check the current code and try again.');
      await onVerified();
    } catch (failure) { setCode(''); setMessage(failure instanceof Error ? failure.message : 'Authenticator verification is unavailable.'); summary.current?.focus(); }
    finally { submitting.current = false; setBusy(false); onBusy?.(false); }
  }
  return <form onSubmit={submit} className="grid gap-4"><p ref={summary} tabIndex={-1} role="status">{message}</p>{factors.length > 0 && <><label className="grid gap-2">Authenticator app<select className="rounded-lg border bg-transparent p-3" value={factorId} onChange={event => { setFactorId(event.target.value); setCode(''); }} disabled={busy}>{factors.map(factor => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select></label><label className="grid gap-2">Authenticator code<input autoFocus className="rounded-lg border bg-transparent p-3" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={event => setCode(event.target.value)} disabled={busy} /></label><button disabled={busy} className="rounded-lg bg-[var(--accent)] p-3 text-white">Verify authenticator</button></>}</form>;
}
