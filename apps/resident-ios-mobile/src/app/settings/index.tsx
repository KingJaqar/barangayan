import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Action, Body, Card, Destination, Notice, Screen } from '../../components/ui';
import { useResident } from '../../lib/runtime';

export default function SettingsScreen() {
  const { session, profile, logout } = useResident();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function signOut() {
    if (busy) return;
    setBusy(true); setError('');
    try { await logout(); router.replace('/auth'); }
    catch { setError('This device still has account data to clear. Keep the app open and try again.'); }
    finally { setBusy(false); }
  }
  return <Screen><Body heading>Settings</Body>{session ? <>
    <Card><Body heading>{profile?.full_name ?? 'Resident account'}</Body><Body>{profile?.email ?? session.user.email ?? ''}</Body><Destination title="Edit profile" href="/profile" /><Destination title="Change password" href="/settings/change-password" /></Card>
    <Card><Body heading>Information</Body><Destination title="Help and frequently asked questions" href="/settings/help" /><Destination title="Resident information" href="/settings/information" /></Card>
    <Card><Body heading>Privacy and notifications</Body><Notice message="Remote notifications, complete data export, and account deletion remain unavailable until their backend and privacy release checks are complete." /></Card>
    {!!error && <Notice message={error} />}<Action label={busy ? 'Signing out…' : 'Sign out'} disabled={busy} onPress={() => void signOut()} />
  </> : <><Card><Body>Sign in to manage your resident account.</Body><Destination title="Sign in" href="/auth" /></Card><Card><Destination title="Help and frequently asked questions" href="/settings/help" /><Destination title="Resident information" href="/settings/information" /></Card></>}</Screen>;
}
