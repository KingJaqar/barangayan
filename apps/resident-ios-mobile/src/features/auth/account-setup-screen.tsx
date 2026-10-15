import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { useAuthFlow } from '../../auth/auth-flow';
import { authRequests, profileRequests } from '../../auth/request-gate';
import { useResident } from '../../lib/runtime';
import { DetailsForm } from './details-form';
import { AuthenticatedRedirect } from './parts';
import { emptyPasswordDraft, PasswordStep, type PasswordDraft } from './password-step';
import { SetupStatusView } from './setup-status-view';

/** Server-owned account setup: details, then password, then the authorized destination. */
export default function AccountSetupScreen() {
  const { session, recovery } = useResident();
  if (recovery) return <Redirect href="/auth/recovery" />;
  if (!session) return <Redirect href="/auth/choice" />;
  // Drafts survive moving between the two steps but never cross accounts.
  return <OwnedSetup key={session.user.id} />;
}

function OwnedSetup() {
  const { logout, setRecovery } = useResident();
  const { route, appAllowed, setIntent, refreshSetup, refreshError } = useAuthFlow();
  const router = useRouter();
  const [editingDetails, setEditingDetails] = useState(false);
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<PasswordDraft>(emptyPasswordDraft);
  const busy = () => authRequests.busy || profileRequests.busy;

  async function signOut() {
    if (busy()) { setNotice('A request is still finishing. Please wait before signing out.'); return; }
    await logout();
  }
  async function skip() { if (!busy()) { await setIntent('sign_in'); await refreshSetup(); } }
  async function detailsSaved() {
    setEditingDetails(false);
    await setIntent('provider_details_saved');
    await refreshSetup();
  }
  async function passwordSaved() { await setIntent('sign_in'); await refreshSetup(); }
  function recover() {
    void (async () => {
      await setRecovery(true);
      router.replace('/auth/recovery');
    })().catch(() => setNotice('Unable to start recovery. Please try again.'));
  }

  const destination = route.destination;
  if (destination === 'details' || (editingDetails && destination === 'password')) {
    const required = destination === 'details' && route.required;
    return <DetailsForm required={required} onSaved={detailsSaved} onSkip={() => { void skip(); }} onSignOut={() => { void signOut(); }} />;
  }
  if (destination === 'password') {
    return <PasswordStep required={route.required} draft={draft} onDraftChange={setDraft} onSaved={passwordSaved}
      onSkip={() => { void skip(); }} onBack={() => {
        if (busy()) { setNotice('A request is still finishing. Please wait before leaving this step.'); return; }
        if (draft.uncertain) { setNotice('Confirm whether your entered password was saved, or use password recovery, before leaving this step.'); return; }
        setEditingDetails(true);
      }} onRecover={recover} onSignOut={() => { void signOut(); }} />;
  }
  // `manage_password` stays here only while email-origin password history is unresolved.
  const unresolved = destination === 'manage_password' && !appAllowed;
  if (destination === 'status_loading' || destination === 'status_error' || unresolved) {
    return <SetupStatusView state={unresolved ? 'recovery' : destination === 'status_error' ? 'error' : 'loading'}
      notice={notice || refreshError || undefined} onRetry={refreshSetup} onRecover={recover} onSignOut={() => { void signOut(); }} />;
  }
  return <AuthenticatedRedirect />;
}
