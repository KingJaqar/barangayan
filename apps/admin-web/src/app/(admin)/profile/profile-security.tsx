'use client';
import { beginAttempt, notify, setNotificationSession } from '@/lib/notify';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ProfileDialog } from '@/components/admin/profile-dialog';
import { openAccountProof, type AccountProof } from '@/lib/admin-profile/proof-window';
import { changeAdminEmail, changeAdminPassword, readAdminSecurity, requestAdminSecurityCode } from './actions';
import styles from './profile.module.css';

export function ProfileSecurity({ security, enabled, disabled, onBusy }: {
  security: { email: string | null; newEmail: string | null; confirmed: boolean; providers: string[] }; enabled: boolean; disabled: boolean; onBusy: (busy: boolean) => void;
}) {
  const [currentSecurity, setCurrentSecurity] = useState(security);
  const [needsReview, setNeedsReview] = useState(false);
  const [mode, setMode] = useState<'email' | 'password' | null>(null);
  const [currentPassword, setCurrentPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [confirmation, setConfirmation] = useState('');
  const [email, setEmail] = useState(''); const [nonce, setNonce] = useState('');
  const [showPasswords, setShowPasswords] = useState(false); const [busy, setBusy] = useState(false);
  const [providerProof, setProviderProof] = useState(false);
  const [message, setMessage] = useState<string | null>(null); const [signIn, setSignIn] = useState(false);
  const submitting = useRef(false); const summary = useRef<HTMLParagraphElement>(null); const modalSummary = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (message) (modalSummary.current ?? summary.current)?.focus(); }, [message]);
  function close() { if (busy) return; setMode(null); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setNonce(''); setShowPasswords(false); setProviderProof(false); }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!mode || submitting.current || needsReview) return;
    submitting.current = true; setBusy(true); onBusy(true); setMessage(null);
    const attempt = beginAttempt('admin-credentials');
    let proof: AccountProof | null = null;
    let sessionsRevoked = false;
    try {
      if (providerProof) proof = await openAccountProof('admin');
      const verified = proof?.accessToken ? { accessToken: proof.accessToken } : { currentPassword };
      const result = mode === 'email' ? await changeAdminEmail({ email, ...verified }) : await changeAdminPassword({ ...verified, newPassword, confirmPassword: confirmation, ...(nonce ? { nonce } : {}) });
      setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setNonce('');
      if (!result.ok) { notify[result.code === 'unavailable' ? 'warning' : 'error']('Could not confirm the account change. Review the details before trying again.', { id: attempt }); sessionsRevoked = result.sessionsRevoked ?? false; setMessage(result.message); setNeedsReview(result.code === 'unavailable'); }
      else {
        sessionsRevoked = result.value.sessionsRevoked;
        if (result.value.signInRequired) setNotificationSession(null);
        notify[result.warning ? 'warning' : 'success'](result.warning ?? (mode === 'email' ? 'Email change requested. Check your confirmation emails.' : 'Password changed. Sign in again with your new password.'), { id: result.value.signInRequired ? beginAttempt('admin-security-signed-out') : attempt, keepOnSessionChange: result.value.signInRequired });
        setMode(null); setShowPasswords(false); setSignIn(result.value.signInRequired);
        if (!result.value.signInRequired) { const fresh = await readAdminSecurity(); if (fresh.ok) setCurrentSecurity(fresh.value); }
        setMessage(result.warning ?? (mode === 'email' ? 'Email change requested. Follow the confirmation messages in your inboxes. Reload this page after confirmation to check the sign-in address. Contact email and resident credentials are unchanged.' : 'Password changed. Admin sessions were signed out. Sign in again with your new password.'));
      }
    } catch { notify.warning('The account change could not be confirmed. Check your sign-in state before retrying.', { id: attempt }); setNeedsReview(true); setMessage('The credential outcome could not be confirmed. Check your current sign-in state before retrying.'); setCurrentPassword(''); setNewPassword(''); setConfirmation(''); }
    finally { proof?.retire(sessionsRevoked); submitting.current = false; setBusy(false); onBusy(false); }
  }
  async function reviewEmail() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); onBusy(true);
    try {
      const current = await readAdminSecurity();
      if (!current.ok) { setMessage(current.message); notify.error('Could not check your sign-in email. Please try again.'); return; }
      setCurrentSecurity(current.value);
      notify.info(current.value.newEmail ? 'Email confirmation is still pending. Check your inboxes.' : 'Current sign-in email checked. Review the details below.');
      if (current.value.email === email.trim() || current.value.newEmail === email.trim()) { setCurrentPassword(''); setNewPassword(''); setConfirmation(''); setNonce(''); setMode(null); setNeedsReview(false); setMessage(current.value.newEmail ? 'Email confirmation is pending. Follow the inbox instructions; do not repeat the request.' : 'Your sign-in email change is confirmed. Contact email remains independent.'); }
      else { setNeedsReview(false); setMessage('Current sign-in state checked. Review your address before retrying.'); }
    } catch { notify.error('Could not check your sign-in email. Please try again.'); setMessage('Current sign-in state could not be checked. Keep this request paused and try status checking again.'); }
    finally { submitting.current = false; setBusy(false); onBusy(false); }
  }
  async function code() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); onBusy(true);
    try { const result = await requestAdminSecurityCode(); notify[result.ok ? 'success' : 'error'](result.ok ? 'Verification code requested. Check your admin inbox.' : 'Could not request a verification code. Review the details below.'); setMessage(result.ok ? 'Verification code requested. Check your admin sign-in inbox.' : result.message); }
    catch { notify.warning('We could not confirm the code request. Check your inbox before trying again.'); setMessage('Verification code could not be requested. Try again later.'); }
    finally { submitting.current = false; setBusy(false); onBusy(false); }
  }
  return <section className={styles.section}><h2>Admin account security</h2><p className={styles.subtitle}>These controls affect your admin sign-in only. Contact email and resident credentials stay separate.</p><dl className={styles.details}><div><dt>Sign-in email</dt><dd>{currentSecurity.email ?? 'Not provided'}</dd></div><div><dt>Auth email confirmation</dt><dd>{currentSecurity.confirmed ? 'Confirmed' : 'Not confirmed'}</dd></div><div><dt>Login providers</dt><dd>{currentSecurity.providers.join(', ') || 'Not provided'}</dd></div>{currentSecurity.newEmail && <div><dt>Awaiting email confirmation</dt><dd>{currentSecurity.newEmail}</dd></div>}</dl>
    {!enabled && <p className="mt-4">Credential changes are awaiting verification of sign-in settings, callbacks and email delivery.</p>}
    {message && <p ref={summary} tabIndex={-1} role="status" className={styles.message}>{message}</p>}
    {signIn ? <Link className={`${styles.button} inline-block`} href="/login">Sign in again</Link> : <div className={styles.actions}><button type="button" className={styles.button} disabled={!enabled || disabled || busy} onClick={() => { setMode('email'); setMessage(null); }}>Change sign-in email</button><button type="button" className={styles.button} disabled={!enabled || disabled || busy} onClick={() => { setMode('password'); setMessage(null); }}>Change password</button></div>}
    {mode && <ProfileDialog label={mode === 'email' ? 'Change admin sign-in email' : 'Change admin password'} onClose={close} preventClose={busy}><div className={`${styles.section} ${styles.modal}`}><h2>{mode === 'email' ? 'Change admin sign-in email' : 'Change admin password'}</h2><p className={styles.subtitle}>{mode === 'email' ? 'Keep access to both the current and new inboxes until confirmation completes.' : 'After success, all admin sessions are signed out and a fresh login is required. Resident sessions are unaffected.'}</p>
      {needsReview && (mode === 'email' ? <button type="button" className={styles.button} disabled={busy} onClick={reviewEmail}>Check current sign-in email</button> : <p className="my-4">The password may have changed. <Link href="/login" className="underline">Sign in again</Link> before repeating a password operation.</p>)}
      <form onSubmit={submit} className={styles.form}>
        <label className="flex items-center gap-2"><input type="checkbox" checked={providerProof} disabled={busy} onChange={event => { setProviderProof(event.target.checked); setCurrentPassword(''); }} />Verify through a separate account sign-in</label>
        {!providerProof && <label className={styles.field}>Current admin password<input autoFocus type={showPasswords ? 'text' : 'password'} autoComplete="current-password" required value={currentPassword} disabled={busy} onChange={event => setCurrentPassword(event.target.value)} /></label>}
        {mode === 'email' ? <label className={styles.field}>New sign-in email<input type="email" autoComplete="email" required maxLength={254} disabled={busy} value={email} onChange={event => setEmail(event.target.value)} /></label> : <><label className={styles.field}>New password<input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" minLength={8} required disabled={busy} value={newPassword} onChange={event => setNewPassword(event.target.value)} aria-describedby="new-password-hint" /></label><p id="new-password-hint" className={styles.subtitle}>At least 8 characters with uppercase and lowercase letters, a number and a special character. Use a different password from your current one.</p><label className={styles.field}>Confirm new password<input type={showPasswords ? 'text' : 'password'} autoComplete="new-password" required disabled={busy} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></label><label className={styles.field}>Verification code, if requested<input inputMode="numeric" autoComplete="one-time-code" disabled={busy} value={nonce} onChange={event => setNonce(event.target.value)} /></label><button type="button" className={styles.button} disabled={busy} onClick={code}>Request verification code</button></>}
        <label className="flex items-center gap-2"><input type="checkbox" checked={showPasswords} onChange={event => setShowPasswords(event.target.checked)} />Show passwords</label>
        <p className={styles.subtitle}>To set your first password, select separate account sign-in and verify your existing admin account through its sign-in inbox.</p>
        <div className={styles.actions}><button className={`${styles.button} ${styles.primary}`} disabled={busy || needsReview}>{busy ? 'Submitting…' : mode === 'email' ? 'Request email change' : 'Change admin password'}</button><button type="button" className={styles.button} disabled={busy} onClick={close}>Cancel</button></div>
      </form>{message && <p ref={modalSummary} tabIndex={-1} role="alert" className={styles.message}>{message}</p>}
    </div></ProfileDialog>}
  </section>;
}
