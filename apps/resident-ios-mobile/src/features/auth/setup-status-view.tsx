import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Action, Body, Card, Notice, Screen } from '../../components/ui';
import { space } from '../../lib/theme';
import { EmergencyEntry } from './parts';

/** Waiting, failed or unresolved-password state of the server-owned setup check. */
export function SetupStatusView({ state, notice, onRetry, onRecover, onSignOut }: {
  state: 'loading' | 'error' | 'recovery';
  notice?: string;
  onRetry: () => Promise<void>;
  onRecover: () => void;
  onSignOut: () => void;
}) {
  const [takingLong, setTakingLong] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const loading = state === 'loading' || retrying;
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTakingLong(true), 12_000);
    return () => clearTimeout(timer);
  }, [loading]);

  async function retry() {
    if (retrying) return;
    setRetrying(true); setTakingLong(false);
    try { await onRetry(); } finally { setRetrying(false); }
  }
  const title = loading ? 'Getting things ready' : state === 'recovery' ? "Let's recover your password" : "Let's try that again";
  const description = loading
    ? takingLong ? 'This is taking longer than usual. You can try checking again.' : 'We are checking your account setup. You will be on your way shortly.'
    : state === 'recovery' ? 'We could not confirm your password history. Recover your password to keep your existing account secure.'
    : 'We could not load your account setup. Check your connection and try again.';
  return <Screen>
    <Card>
      <Body heading>{title}</Body>
      <Body tone="secondary">{description}</Body>
      {loading && <View style={{ paddingVertical: space[3] }}><ActivityIndicator accessibilityLabel="Checking your account setup" /></View>}
      {(!loading || takingLong) && <Action label={state === 'recovery' ? 'Recover password' : 'Try again'} disabled={retrying} onPress={state === 'recovery' ? onRecover : () => void retry()} />}
      {!!notice && <Notice message={notice} />}
    </Card>
    <Card><EmergencyEntry /></Card>
    <Action label="Sign out" secondary onPress={onSignOut} />
  </Screen>;
}
