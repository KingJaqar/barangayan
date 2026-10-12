import { Redirect, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { AccountSetupStatus } from '@/components/account-setup-status';
import { ResidentDetailsForm } from '@/components/resident-details-form';
import { ResidentPasswordStep, type ResidentPasswordDraft } from '@/components/resident-password-step';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { authSetupRequests, profileSetupRequests } from '@/lib/setup-request';

export default function AccountSetup() {
  const { session } = useAuth();
  // In-memory drafts survive wizard back/forward, but never cross accounts.
  return <OwnedAccountSetup key={session?.user.id ?? 'signed-out'} />;
}
function OwnedAccountSetup() {
  const { session, setupRoute: route, refreshCompletion, setSetupIntent, logout, setPasswordRecovery, signedOutEntry } = useAuth();
  const theme = useTheme();
  const router = useRouter();
  const [editingDetails, setEditingDetails] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [passwordDraft, setPasswordDraft] = useState<ResidentPasswordDraft>({ password: '', confirmPassword: '', uncertain: false });
  const busy = () => authSetupRequests.busy || profileSetupRequests.busy;
  function back() {
    if (busy()) { setNotice('A request is still finishing. Please wait before leaving this step.'); return; }
    if (passwordDraft.uncertain) { setNotice('Confirm whether your entered password was saved, or use password recovery, before leaving this step.'); return; }
    if (route.destination === 'password' && !editingDetails) { setEditingDetails(true); return; }
    if ((route.destination === 'details' || route.destination === 'password') && !route.required) { void setSetupIntent('sign_in'); return; }
    setNotice('Your email is verified. Finish setup to continue, or sign out below.');
  }
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.destination, editingDetails, passwordDraft.uncertain]);
  async function skip() { if (!busy()) await setSetupIntent('sign_in'); }
  async function savedDetails() {
    setEditingDetails(false);
    await setSetupIntent('google_details_saved');
    await refreshCompletion();
  }
  async function savedPassword() { await setSetupIntent('sign_in'); await refreshCompletion(); }
  if (route.destination === 'home' || route.destination === 'existing_access') return <Redirect href="/home" />;
  if (route.destination === 'recovery') return <Redirect href="/(auth)/forgot-password" />;
  if (!session) return <Redirect href={signedOutEntry ? '/(auth)/login' : '/(auth)/auth-choice'} />;
  if (route.destination === 'details' || (editingDetails && route.destination === 'password')) return <>
    <ResidentDetailsForm key={session.user.id} required={route.required} onSaved={savedDetails} onSkip={() => { void skip(); }} onBack={back} />
    {notice && <ThemedText accessibilityLiveRegion="polite" style={{ padding: 16, backgroundColor: theme.background }}>{notice}</ThemedText>}
  </>;
  if (route.destination === 'password') return <>
    <ResidentPasswordStep key={session.user.id} required={route.required} draft={passwordDraft} onDraftChange={setPasswordDraft} onSaved={savedPassword} onSkip={() => { void skip(); }} onBack={back} />
    {notice && <ThemedText accessibilityLiveRegion="polite" style={{ padding: 16, backgroundColor: theme.background }}>{notice}</ThemedText>}
  </>;
  return <AccountSetupStatus
    key={route.destination}
    state={route.destination === 'manage_password' ? 'recovery' : route.destination === 'status_error' ? 'error' : 'loading'}
    notice={notice}
    onRetry={refreshCompletion}
    onRecover={() => { setPasswordRecovery(true); router.replace('/(auth)/forgot-password'); }}
    onSignOut={() => { if (busy()) setNotice('A request is still finishing. Please wait before signing out.'); else void logout(); }}
  />;
}
