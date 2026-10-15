'use client';

import { createClient } from '@supabase/supabase-js';
import { EMAIL_REGEX } from '@barangayan/shared';
import { ProfileMfaForm } from '@/components/admin/profile-mfa-form';
import type { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from 'react';
import { challengeSchema, type ProfileDatabase } from '@/lib/admin-profile/schema';

function subscribeOpener(callback: () => void) {
  window.addEventListener('focus', callback);
  return () => window.removeEventListener('focus', callback);
}
function openerAvailable() { const opener = window.opener as Window | null; return Boolean(opener && !opener.closed); }

export function ProofPanel({ purpose, request, challenge }: { purpose: 'admin' | 'resident'; request: string; challenge?: string }) {
  const hasOpener = useSyncExternalStore(subscribeOpener, openerAvailable, () => true);
  const lifecycle = useRef({ generation: 0 });
  const client = useRef<ReturnType<typeof createClient<ProfileDatabase>> | null>(null);
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [emailProof, setEmailProof] = useState(false); const [code, setCode] = useState(''); const [codeSent, setCodeSent] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [proofAuth, setProofAuth] = useState<ReturnType<typeof createSupabaseBrowserClient>['auth'] | null>(null);
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false); const [proved, setProved] = useState(false);
  const submitting = useRef(false);
  const proofSent = useRef(false);
  const isMounted = useRef(true);
  const summary = useRef<HTMLParagraphElement>(null);

  const sendProof = useCallback(async () => {
    const isolated = client.current;
    if (!isolated || proofSent.current) return;
    const opener = window.opener as Window | null;
    if (!opener || opener.closed) throw new Error('Open verification again from your active admin profile.');
    const resident = purpose === 'resident';
    const { data: { user }, error } = await isolated.auth.getUser();
    if (error || !user) throw new Error('Could not verify this sign-in.');
    const assurance = await isolated.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance.error) throw new Error('Multi-factor sign-in status could not be checked. Start again.');
    if (assurance.data?.nextLevel === 'aal2' && assurance.data.currentLevel !== 'aal2') {
      setMfaRequired(true); setPassword(''); setCode('');
      setMessage('Complete your account’s authenticator verification before ownership can be confirmed.');
      return;
    }
    if (resident) {
      const parsed = challengeSchema.safeParse(challenge);
      if (!parsed.success) throw new Error('Proof expired. Start from your admin profile.');
      const result = await isolated.rpc('resident_prove_admin_association', { p_challenge: parsed.data });
      if (result.error || !result.data) throw new Error('This resident account cannot be linked. Check its role, barangay and active status.');
    }
    const session = await isolated.auth.getSession();
    if (!session.data.session) throw new Error('Sign-in expired. Start again.');
    proofSent.current = true; setProved(true);
    setPassword(''); setCode(''); setMessage('Ownership verified. Return to the admin profile to finish. Keep this window open until verification closes.');
    opener.postMessage({ type: 'profile-proof-ready', request, ...(resident ? {} : { accessToken: session.data.session.access_token }) }, window.location.origin);
  }, [purpose, request, challenge]);

  useEffect(() => {
    isMounted.current = true;
    const lifecycleState = lifecycle.current;
    const generation = ++lifecycleState.generation;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!window.opener || !url || !key) return;
    const isolated = client.current ?? createClient<ProfileDatabase>(url, key, { global: { fetch: (input, init) => fetch(input, { ...init, keepalive: String(input).includes('/logout') }) }, auth: { persistSession: false, autoRefreshToken: false, storageKey: `profile-proof-${request}`, flowType: 'implicit', detectSessionInUrl: true } });
    client.current = isolated;
    let retiring = false;
    async function retire() {
      if (retiring) return;
      retiring = true;
      let failed = false;
      try { const result = await isolated.auth.signOut({ scope: 'local' }); failed = Boolean(result.error); } catch { failed = true; }
      if (failed) { retiring = false; if (isMounted.current) setMessage('Temporary sign-in cleanup failed. Keep this window open and use Close verification to retry cleanup.'); return; }
      window.close();
    }
    function receive(event: MessageEvent<unknown>) {
      if (event.origin !== window.location.origin || event.source !== window.opener || !event.data || typeof event.data !== 'object') return;
      const payload = event.data as Record<string, unknown>;
      if (payload.type === 'retire-profile-proof' && payload.request === request) {
        if (payload.sessionRevoked === true) { retiring = true; client.current = null; window.close(); }
        else void retire();
      }
    }
    function pageHide() { if (client.current === isolated) void isolated.auth.signOut({ scope: 'local' }).catch(() => undefined); }
    window.addEventListener('pagehide', pageHide);
    window.addEventListener('message', receive);
    const expiry = window.setTimeout(() => { void retire(); }, 5 * 60 * 1000);
    void isolated.auth.getSession().then(async result => { if (!isMounted.current) return; setReady(true); setProofAuth(isolated.auth); if (result.data.session) await sendProof(); }).catch(() => { if (isMounted.current) setMessage('Sign-in could not be confirmed. Start again.'); });
    return () => { isMounted.current = false; window.clearTimeout(expiry); window.removeEventListener('message', receive); window.removeEventListener('pagehide', pageHide); queueMicrotask(() => { if (lifecycleState.generation === generation && client.current === isolated) { client.current = null; void isolated.auth.signOut({ scope: 'local' }).catch(() => undefined); } }); };
  }, [request, sendProof]);
  useEffect(() => { if (message) summary.current?.focus(); }, [message]);

  async function submit(event: FormEvent) {
    event.preventDefault(); if (submitting.current || !client.current) return;
    submitting.current = true; setBusy(true); setMessage('');
    try {
      if (!EMAIL_REGEX.test(email.trim()) || email.trim().length > 254 || (emailProof && !/^\d{6,10}$/.test(code))) throw new Error('Enter your sign-in email and a valid verification code.');
      const result = emailProof
        ? await client.current.auth.verifyOtp({ email: email.trim(), token: code, type: 'email' })
        : await client.current.auth.signInWithPassword({ email: email.trim(), password });
      setPassword(''); setCode('');
      if (result.error) throw new Error('Sign-in failed. Check your credentials and try again.');
      await sendProof();
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Verification failed.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function requestCode() {
    if (!client.current || submitting.current) return;
    submitting.current = true; setBusy(true);
    try {
      if (!EMAIL_REGEX.test(email.trim()) || email.trim().length > 254) throw new Error('Enter your existing account’s sign-in email.');
      const result = await client.current.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}${window.location.pathname}${window.location.search}` } });
      if (result.error) throw new Error('Email verification could not be requested. Check the existing account’s email sign-in availability and try again later.');
      setCodeSent(true); setPassword(''); setCode(''); setMessage('Check your sign-in inbox for a code or link. Open the link in this verification window. This operation does not create an account.');
    } catch (failure) { setMessage(failure instanceof Error ? failure.message : 'Email verification is unavailable.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  async function close() {
    if (!client.current) { window.close(); return; }
    let failed = false;
    try { const result = await client.current.auth.signOut({ scope: 'local' }); failed = Boolean(result.error); } catch { failed = true; }
    if (failed) { setMessage('Temporary sign-in cleanup failed. Try closing verification again.'); return; }
    window.close();
  }
  return <main className="h-full overflow-y-auto bg-zinc-50 p-6 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100"><h1 className="text-2xl font-bold">Verify {purpose} account ownership</h1><p className="my-4">This separate sign-in keeps your main admin session in place. Use the existing {purpose} account you own.</p>
    {!hasOpener && <p role="alert" className="my-4 rounded-lg border p-3">The admin window is unavailable. Close verification and start again from your admin profile.</p>}
    {message && <p ref={summary} tabIndex={-1} role="status" className="my-4 rounded-lg border p-3">{message}</p>}
    {!proved && mfaRequired && proofAuth && <ProfileMfaForm auth={proofAuth} onVerified={sendProof} onBusy={setBusy} />}
    {!proved && !mfaRequired && <form onSubmit={submit} className="grid gap-4"><label className="grid gap-2">Sign-in email<input className="rounded-lg border bg-transparent p-3" type="email" autoComplete="username" maxLength={254} required value={email} onChange={event => { setEmail(event.target.value); setCodeSent(false); setCode(''); }} disabled={busy || !ready} /></label>
      {emailProof ? <><p>Use your existing account’s verified sign-in inbox, including accounts normally accessed through Google. Email sign-in must be enabled for that account.</p><button type="button" disabled={busy || !ready || !hasOpener} className="rounded-lg border p-3" onClick={requestCode}>{codeSent ? 'Request another code or link' : 'Request code or link'}</button><label className="grid gap-2">Email verification code<input className="rounded-lg border bg-transparent p-3" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" required value={code} onChange={event => setCode(event.target.value)} disabled={busy || !codeSent} /></label></> : <label className="grid gap-2">Password<input className="rounded-lg border bg-transparent p-3" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy || !ready} /></label>}
      <button disabled={busy || !ready || !hasOpener || (emailProof && !codeSent)} className="rounded-lg bg-[var(--accent)] p-3 text-white">{busy ? 'Verifying…' : 'Verify ownership'}</button><button type="button" disabled={busy || !ready || !hasOpener} className="rounded-lg border p-3" onClick={() => { setEmailProof(value => !value); setPassword(''); setCode(''); setCodeSent(false); }}>{emailProof ? 'Use password instead' : 'Use email verification instead'}</button></form>}
    <button type="button" className="mt-4 rounded-lg border p-3" disabled={busy} onClick={close}>Close verification</button>
  </main>;
}
