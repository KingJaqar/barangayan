import { residentEmailVerification } from '@barangayan/shared';
import { useEffect, useRef, useState } from 'react';
import { RequireResident } from '../../components/require-resident';
import { Action, Body, Card, Field, Loading, Notice, Screen, StatusBadge } from '../../components/ui';
import { useResident } from '../../lib/runtime';

const RESEND_SECONDS = 60;

export default function EmailVerificationRoute() {
  return <RequireResident purpose="verify your email"><EmailVerification /></RequireResident>;
}

function EmailVerification() {
  const { session, profile, refreshProfile } = useResident();
  const [loadError, setLoadError] = useState('');
  const [retrying, setRetrying] = useState(false);
  const owner = session?.user.id;
  if (!owner || !session) return null;
  if (!profile || profile.id !== owner) {
    // A resident whose profile row is not committed yet has nothing to verify.
    return <Screen><Card>
      <Body tone="secondary">Complete your profile first if you have not yet. Your email can be verified once your profile exists.</Body>
      {!!loadError && <Notice tone="danger" message={loadError} />}
      {retrying ? <Loading label="Loading your profile…" /> : <Action label="Check again" secondary onPress={() => {
        setLoadError(''); setRetrying(true);
        void refreshProfile().catch(() => setLoadError('Unable to load your profile. Check your connection and retry.')).finally(() => setRetrying(false));
      }} />}
    </Card></Screen>;
  }
  return <Form key={`${owner}:${session.user.email ?? ''}:${profile.email ?? ''}`} owner={owner} email={session.user.email ?? ''} profileEmail={profile.email ?? ''}
    verified={profile.email_verification_status === 'verified'} onVerified={refreshProfile} />;
}

type Tone = 'primary' | 'danger';
function Form({ owner, email, profileEmail, verified: savedVerified, onVerified }: { owner: string; email: string; profileEmail: string; verified: boolean; onVerified: () => Promise<void> }) {
  const { client } = useResident();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: Tone } | null>(null);
  const [busy, setBusy] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [accepted, setAccepted] = useState(false);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const active = useRef(true);
  const running = useRef(false);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  // The profile address must match the sign-in address the code is sent to.
  const matches = !!email && email.trim().toLowerCase() === profileEmail.trim().toLowerCase();
  const verified = matches && (savedVerified || accepted);
  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { active.current = false; clearInterval(timer); };
  }, []);

  async function reloadStatus() {
    try { await onVerified(); if (active.current) {
      setRefreshFailed(false);
      setMessage({ text: 'Your email is verified.', tone: 'primary' });
    } }
    catch { if (active.current) {
      setRefreshFailed(true);
      setMessage({ text: 'The code was accepted, but your saved status could not be refreshed. Check again when connected.', tone: 'danger' });
    } }
  }

  async function submit(action: 'send' | 'verify') {
    if (running.current || !matches || verified || (action === 'send' && remaining > 0)) return;
    running.current = true;
    setBusy(true); setMessage(null);
    if (action === 'send') { setCode(''); setDeadline(Date.now() + RESEND_SECONDS * 1000); setNow(Date.now()); }
    try {
      const state = await residentEmailVerification(client, owner, action, code);
      if (!active.current) return;
      if (state === 'verified') { setCode(''); setAccepted(true); setMessage({ text: 'Your email is verified.', tone: 'primary' }); await reloadStatus(); }
      else { setPending(true); setMessage({ text: 'A six-digit code was sent to your sign-in email.', tone: 'primary' }); }
    } catch (failure) {
      if (active.current) setMessage({ text: failure instanceof Error ? failure.message : 'Unable to verify your email. Please try again.', tone: 'danger' });
    } finally {
      running.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <Screen>
    <Body heading>{verified ? 'Email verified' : pending ? 'Check your inbox' : 'Verify your email'}</Body>
    <Body tone="secondary">{verified ? 'This address is confirmed for your Barangayan account.'
      : pending ? 'Enter the six-digit code we sent. You stay signed in.' : 'We will send a six-digit code to confirm this address belongs to you.'}</Body>
    <Card>
      <StatusBadge label={verified ? 'Verified' : 'Not verified'} icon={verified ? 'checkmark.seal' : 'envelope'} tone={verified ? 'success' : 'neutral'} />
      <Body tone="secondary" role="footnote">Sign-in email</Body>
      <Body>{email}</Body>
    </Card>
    {!matches && <Notice message="Save your sign-in email in your profile before verifying it." />}
    {message && <Notice tone={message.tone} message={message.text} />}
    {refreshFailed && <Action label="Check saved verification status" secondary disabled={busy} onPress={() => { void reloadStatus(); }} />}
    {verified && <Body tone="secondary" role="footnote">If you change your email in your profile, you will need to verify the new address.</Body>}
    {matches && !verified && <Card>
      {pending && <>
        <Field label="Verification code" required value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} editable={!busy} placeholder="000000" />
        <Action label={busy ? 'Verifying…' : 'Verify email'} disabled={busy || code.length !== 6} onPress={() => void submit('verify')} />
      </>}
      <Action label={remaining > 0 ? `Resend in ${remaining}s` : pending ? 'Resend code' : busy ? 'Sending…' : 'Send code'} secondary={pending} disabled={busy || remaining > 0} onPress={() => void submit('send')} />
    </Card>}
  </Screen>;
}
