import { residentPasswordStepSchema, residentSetupFailure } from '@barangayan/shared';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { fetchSetupStatus } from '../../auth/setup-status';
import { authRequests, Ownership, SetupTimeout, WriteBoundary } from '../../auth/request-gate';
import { classifyFailure } from '../../data/outcome';
import { Action, Body, Card, Field, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { EmergencyEntry } from './parts';

/** First-time creation only. Known or unknown existing credentials use Manage Password or recovery. */
export type PasswordDraft = { password: string; confirmPassword: string; uncertain: boolean };
export const emptyPasswordDraft: PasswordDraft = { password: '', confirmPassword: '', uncertain: false };

const REQUIREMENTS = 'Use 8 or more characters with at least one uppercase letter, one number and one special character.';

/**
 * Creates the first password. `beforeWrite` must re-prove fresh same-account provider
 * authentication immediately before the write when the password is set from Settings.
 */
export function PasswordStep({ required, variant = 'setup', draft, onDraftChange, onSaved, onSkip, onBack, onRecover, onSignOut, beforeWrite }: {
  required: boolean;
  variant?: 'setup' | 'settings';
  draft: PasswordDraft;
  onDraftChange: (value: PasswordDraft) => void;
  onSaved: () => Promise<void>;
  onSkip?: () => void;
  onBack?: () => void;
  onRecover: () => void;
  onSignOut?: () => void;
  beforeWrite?: () => Promise<void>;
}) {
  const { client, config, session } = useResident();
  const owner = useRef(new Ownership());
  const { password, confirmPassword, uncertain } = draft;
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  useEffect(() => { const scope = owner.current; return () => scope.invalidate(); }, []);

  async function save() {
    const parsed = residentPasswordStepSchema.safeParse({ password, confirmPassword });
    setErrors({}); setError('');
    if (!uncertain && !parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((issue) => [String(issue.path[0]), issue.message])));
      return;
    }
    if (!session || busy || !parsed.success) {
      if (uncertain && !parsed.success) setError('Enter the password you chose to confirm whether it was saved.');
      return;
    }
    const owns = owner.current.ticket();
    const uid = session.user.id;
    const email = session.user.email;
    const write = new WriteBoundary();
    let confirmed = false;
    setBusy(true);
    try {
      await authRequests.run(async () => {
        if (!owns()) throw new Error('Setup was cancelled.');
        if (uncertain) {
          if (!email) throw new Error('Sign in again to verify your password.');
          // Independent, non-persisting client: checking a lost write cannot switch the app's
          // session, and `passwordSet` alone is never proof of this exact password.
          const verifier = createClient(config.url, config.anonKey, {
            auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
            global: { fetch: (input, init) => {
              const controller = new AbortController();
              const timer = setTimeout(() => controller.abort(), 15_000);
              return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
            } },
          });
          const { data, error: verifyError } = await verifier.auth.signInWithPassword({ email, password: parsed.data.password });
          if (verifyError || data.user?.id !== uid) throw new Error('Password not confirmed. Use password recovery before trying another password.');
          void verifier.auth.signOut({ scope: 'local' });
        } else {
          const status = await fetchSetupStatus(client);
          if (!owns()) throw new Error('Setup was cancelled.');
          if (status.passwordSet !== false) throw new Error('This account already has a password or its history is unknown. Use Manage password or recovery.');
          await beforeWrite?.();
          if (!owns()) throw new Error('Setup was cancelled.');
          write.begin();
          const { error: writeError } = await client.auth.updateUser({ password: parsed.data.password });
          if (writeError) throw writeError;
        }
        confirmed = true;
      });
      if (!owns()) return;
      onDraftChange(emptyPasswordDraft);
      await onSaved();
    } catch (cause) {
      if (!owns()) return;
      // A timeout or transport error can follow a committed write. Never repeat updateUser blindly:
      // the exact entered credential (or recovery) must confirm it first.
      const name = cause instanceof Error ? cause.name : '';
      const code = cause && typeof cause === 'object' && 'code' in cause ? cause.code : null;
      if (write.started && !confirmed && code !== 'weak_password' && code !== 'same_password' && classifyFailure(cause, { write: true }) === 'unknown-commit') {
        onDraftChange({ ...draft, uncertain: true });
      }
      const safe = residentSetupFailure(cause as { code?: string; status?: number; name?: string });
      const local = cause instanceof Error && name === 'Error' && !('code' in cause);
      setError(cause instanceof SetupTimeout || local ? (cause as Error).message : safe.message);
    } finally { write.close(); if (owns()) setBusy(false); }
  }

  const matching = !!password && !!confirmPassword && password === confirmPassword;
  return <Screen>
    <Body heading>Create your password</Body>
    <Body tone="secondary">{variant === 'settings' ? 'Your provider confirmed it is you. Add a password to also sign in with your email; you can keep using your provider.'
      : required ? 'Finish setting up your account so you can sign in with your email and password.'
      : 'You can add a password to also sign in with your email, or keep using your provider.'}</Body>
    <Card>
      <Field label="Password" required value={password} onChangeText={(value) => onDraftChange({ ...draft, password: value })} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" editable={!busy} error={errors.password} />
      <Body tone="secondary" role="footnote">{REQUIREMENTS}</Body>
      <Field label="Confirm password" required value={confirmPassword} onChangeText={(value) => onDraftChange({ ...draft, confirmPassword: value })} secureTextEntry textContentType="newPassword" autoComplete="new-password" autoCapitalize="none" editable={!busy} error={errors.confirmPassword} />
      {!!password && !!confirmPassword && <Body tone={matching ? 'primary' : 'danger'} role="footnote">{matching ? 'Passwords match' : "Passwords don't match"}</Body>}
    </Card>
    {!!error && <Notice tone="danger" message={error} />}
    <Action label={busy ? 'Saving…' : uncertain ? 'Check whether this password was saved' : variant === 'settings' ? 'Set password' : required ? 'Create account' : 'Finish account setup'} disabled={busy} onPress={() => void save()} />
    {!required && !uncertain && onSkip && <Action label={variant === 'settings' ? 'Cancel' : 'Skip for now'} secondary disabled={busy} onPress={onSkip} />}
    {onBack && !uncertain && <Action label="Review personal details" secondary disabled={busy} onPress={onBack} />}
    {!!error && <Action label="Recover password" secondary disabled={busy} onPress={() => {
      if (authRequests.busy) { setError('Please wait for the earlier request to finish before starting recovery.'); return; }
      onDraftChange(emptyPasswordDraft);
      onRecover();
    }} />}
    {variant === 'setup' && onSignOut && <Action label="Sign out" secondary disabled={busy} onPress={() => {
      if (authRequests.busy) { setError('The earlier request is still finishing. Please wait before signing out.'); return; }
      onSignOut();
    }} />}
    {variant === 'setup' && <Card><EmergencyEntry /></Card>}
  </Screen>;
}
