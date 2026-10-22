import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuthFlow } from '../../../auth/auth-flow';
import { accountSettingsRows } from '../../../auth/setup-route';
import { authRequests } from '../../../auth/request-gate';
import { Action, Body, Card, Destination, Notice, Screen, StatusBadge } from '../../../components/ui';
import { appVersionLabel } from '../../../features/information/app-version';
import { useInboxCount } from '../../../features/notifications/inbox-count';
import { inboxDetail } from '../../../features/notifications/model';
import { releaseGates } from '../../../lib/release-gates';
import { useResident } from '../../../lib/runtime';

/** "A", "A and B", "A, B and C", with the first letter capitalized. */
function sentenceList(items: string[]): string {
  const text = items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items.join('');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function SettingsScreen() {
  const { session, profile, logout } = useResident();
  const { setup, providers, setIntent, refreshSetup } = useAuthFlow();
  const router = useRouter();
  const inbox = useInboxCount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [linked, setLinked] = useState(false);
  const rows = accountSettingsRows(setup);
  const unavailable = [!releaseGates.remotePush && 'Remote notifications', !releaseGates.completeExport && 'complete data export', !releaseGates.accountDeletion && 'account deletion'].filter((name): name is string => !!name);
  const status = setup.state === 'ready' ? setup.status : null;
  const verified = profile?.email_verification_status === 'verified';

  async function signOut() {
    if (busy) return;
    if (authRequests.busy) { setError('A request is still finishing. Please wait before logging out.'); return; }
    setBusy(true); setError('');
    try { await logout(); router.replace('/auth/choice'); }
    catch { setError('This device still has account data to clear. Keep the app open and try again.'); }
    finally { setBusy(false); }
  }
  async function linkGoogle() {
    if (busy) return;
    setBusy(true); setError(''); setLinked(false);
    try {
      const attempt = await providers.startGoogle('link');
      await setIntent('settings_profile', attempt.userId ?? undefined);
      await refreshSetup();
      setLinked(true);
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Google could not be linked. Please try again.'); }
    finally { setBusy(false); }
  }

  return <Screen>{session ? <>
    <Card><Body heading>{profile?.full_name ?? 'Resident account'}</Body><Body tone="secondary">{profile?.email ?? session.user.email ?? ''}</Body>
      <Destination title={rows.profile.title} detail={rows.profile.subtitle || undefined} href="/settings/profile" />
      {rows.profile.warning && <StatusBadge label="Details incomplete" icon="exclamationmark.triangle" tone="warning" />}
      <Destination title={rows.password.title} detail={rows.password.subtitle || undefined} href="/settings/change-password" />
      {rows.password.warning && <StatusBadge label="Password not set" icon="exclamationmark.triangle" tone="warning" />}
      <Destination title="Email verification" detail={verified ? 'Verified' : 'Not verified'} href="/settings/email-verification" />
      <Destination title="ID verification" detail="ID type and front and back photos" href="/settings/id-verification" />
      <Destination title="Location verification" detail={profile?.verified_location ? 'A home location is saved' : 'Not saved yet'} href="/settings/location-verification" />
    </Card>
    {status && <Card><Body heading>Sign-in methods</Body>
      <Body tone="secondary">{[
        status.passwordSet === true ? 'Email and password' : status.passwordSet === null ? 'Email and password (unconfirmed)' : null,
        status.hasGoogleIdentity ? 'Google' : null,
        status.hasAppleIdentity ? 'Apple' : null,
      ].filter(Boolean).join(', ') || 'Email code'}</Body>
      {!status.hasGoogleIdentity && <Action label={busy ? 'Waiting for Google…' : 'Link Google account'} secondary disabled={busy || !providers.callbackAvailable} onPress={() => void linkGoogle()} />}
      {linked && <Notice message="Google is now linked to your account." />}
    </Card>}
    <Card><Body heading>Appearance</Body><Destination title="Theme, accent color and font" detail="Light, dark or system, your colors and font style" href="/settings/appearance" /></Card>
    <Card><Body heading>Information</Body><Destination title="Help and frequently asked questions" href="/settings/help" /><Destination title="Terms and Privacy Policy" href="/settings/terms-privacy" /><Destination title="About Us" detail={appVersionLabel()} href="/settings/about" /><Destination title="Introduction to Barangayan" detail="Replay the welcome tour" href="/onboarding/welcome" /></Card>
    <Card><Body heading>Privacy and notifications</Body>
      {releaseGates.remotePush && <>
        <Destination title="Notifications" detail={inboxDetail(inbox.count)} href="/notifications" />
        <Destination title="Phone alerts and preferences" detail="Choose which alerts reach this iPhone" href="/settings/notifications" />
      </>}
      {releaseGates.completeExport && <Destination title="Download My Data" detail="A copy of your information as a PDF or JSON file" href="/settings/download-data" />}
      {releaseGates.accountDeletion && <Destination title="Delete My Account" detail="Permanently delete your account" href="/settings/delete-account" />}
      {unavailable.length > 0 && <Notice message={`${sentenceList(unavailable)} remain unavailable until their backend and privacy release checks are complete.`} />}
    </Card>
    {!!error && <Notice tone="danger" message={error} />}<Action label={busy ? 'Logging out…' : 'Log out'} secondary disabled={busy} onPress={() => void signOut()} />
  </> : <><Card><Body>Log in to manage your resident account.</Body><Destination title="Log in or create an account" href="/auth/choice" /></Card><Card><Destination title="Theme, accent color and font" detail="Light, dark or system, your colors and font style" href="/settings/appearance" /><Destination title="Help and frequently asked questions" href="/settings/help" /><Destination title="Terms and Privacy Policy" href="/settings/terms-privacy" /><Destination title="About Us" detail={appVersionLabel()} href="/settings/about" /><Destination title="Introduction to Barangayan" detail="Replay the welcome tour" href="/onboarding/welcome" /></Card></>}</Screen>;
}
