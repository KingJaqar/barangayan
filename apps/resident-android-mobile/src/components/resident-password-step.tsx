import { residentPasswordStepSchema, getResidentAccountSetupStatus, residentSetupFailure } from '@barangayan/shared';
import { createClient } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { AuthHeader } from './auth-header';
import { FormSection } from './resident-details-form';
import { PrimaryButton } from './primary-button';
import { TextField } from './text-field';
import { ThemedText } from './themed-text';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
import { authSetupRequests, SetupOwner, SetupTimeout, SetupWriteBoundary } from '@/lib/setup-request';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

/** First-time creation only. Known/unknown existing credentials use Manage Password. */
export type ResidentPasswordDraft = { password: string; confirmPassword: string; uncertain: boolean };
/** `settings` is first-password setup from Settings: no sign-out/skip wording, and
 * `beforeWrite` must re-prove fresh same-user authentication right before the write. */
export function ResidentPasswordStep({ required, draft, onDraftChange, onSaved, onSkip, onBack, variant = 'setup', beforeWrite }: { required: boolean; draft: ResidentPasswordDraft; onDraftChange: (value: ResidentPasswordDraft) => void; onSaved: () => Promise<void>; onSkip: () => void; onBack: () => void; variant?: 'setup' | 'settings'; beforeWrite?: () => Promise<void> }) {
  const { session, logout, setPasswordRecovery } = useAuth();
  const router = useRouter();
  const theme = useTheme();
  const resident = variant === 'settings';
  const presentation = resident ? 'resident' : 'default';
  const owner = useRef(new SetupOwner());
  const { password, confirmPassword, uncertain } = draft;
  const setPassword = (value: string) => onDraftChange({ ...draft, password: value });
  const setConfirmPassword = (value: string) => onDraftChange({ ...draft, confirmPassword: value });
  const [visible, setVisible] = useState(false), [confirmVisible, setConfirmVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  useEffect(() => () => { owner.current.invalidate(); }, []);

  async function save(checkOnly = false) {
    const parsed = residentPasswordStepSchema.safeParse({ password, confirmPassword });
    setErrors({}); setError(null);
    if (!parsed.success) { setErrors(Object.fromEntries(parsed.error.issues.map(issue => [String(issue.path[0]), issue.message]))); return; }
    if (!session || loading) return;
    const owns = owner.current.ticket(), uid = session.user.id, email = session.user.email;
    const write = new SetupWriteBoundary();
    setLoading(true);
    try {
      await authSetupRequests.run(async () => {
        if (!owns()) throw new Error('Setup was cancelled.');
        if (checkOnly) {
          if (!email) throw new Error('Sign in again to verify your password.');
          // Independent, non-persisting client: checking a lost write cannot switch
          // the app's session or count passwordSet=true as proof of this password.
          const verifier = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL!, process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }, global: { fetch: (input, init) => {
            const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
            return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
          } } });
          const { data, error: verifyError } = await verifier.auth.signInWithPassword({ email, password: parsed.data.password });
          if (verifyError || data.user?.id !== uid) throw new Error('Password not confirmed. Use password recovery before trying another password.');
          void verifier.auth.signOut({ scope: 'local' });
        } else {
          const status = await getResidentAccountSetupStatus(supabase);
          if (!owns()) throw new Error('Setup was cancelled.');
          if (status.passwordSet !== false) throw new Error('This account already has a password or its history is unknown. Use Manage Password or recovery.');
          await beforeWrite?.();
          if (!owns()) throw new Error('Setup was cancelled.');
          write.begin();
          const { error: writeError } = await supabase.auth.updateUser({ password: parsed.data.password });
          if (writeError) throw writeError;
        }
      });
      if (!owns()) return;
      onDraftChange({ password: '', confirmPassword: '', uncertain: false });
      await onSaved();
    } catch (cause) {
      if (!owns()) return;
      // A timeout/transport error can follow a successful commit. Never blindly
      // repeat updateUser: require the exact entered credential or recovery.
      const transportFailure = ['AbortError', 'TimeoutError', 'TypeError', 'AuthUnknownError', 'AuthRetryableFetchError'].includes((cause as Error).name);
      if (write.started && (cause instanceof SetupTimeout || transportFailure)) onDraftChange({ ...draft, uncertain: true });
      const safe = residentSetupFailure(cause as { code?: string; status?: number; name?: string });
      setError(cause instanceof SetupTimeout || (cause instanceof Error && !('code' in cause) && !transportFailure) ? cause.message : safe.message);
    } finally { write.close(); if (owns()) setLoading(false); }
  }
  const securityFields = <>
          <TextField presentation={presentation} label="Password" accessibilityLabel="Password" required value={password} editable={!loading} onChangeText={setPassword} secureTextEntry={!visible} autoCapitalize="none" autoComplete="new-password" error={errors.password} passwordVisibility={{ visible, onToggle: () => setVisible(value => !value) }} />
          <ThemedText type="small" themeColor="textSecondary">Use 8+ characters with at least one uppercase letter, one number, and one special character.</ThemedText>
          <TextField presentation={presentation} label="Confirm Password" accessibilityLabel="Confirm Password" required value={confirmPassword} editable={!loading} onChangeText={setConfirmPassword} secureTextEntry={!confirmVisible} autoCapitalize="none" autoComplete="new-password" error={errors.confirmPassword} passwordVisibility={{ visible: confirmVisible, onToggle: () => setConfirmVisible(value => !value) }} />
          {!!password && !!confirmPassword && <ThemedText accessibilityLiveRegion="polite" themeColor={password === confirmPassword ? 'accentGreen' : 'accentRed'} style={resident ? { color: password === confirmPassword ? theme.resident.success : theme.resident.danger } : undefined}>{password === confirmPassword ? 'Passwords match' : "Passwords don't match"}</ThemedText>}
</>;
  return <SafeAreaView style={{ flex: 1, backgroundColor: resident ? theme.resident.card : theme.primary }} edges={resident ? ['left', 'right', 'bottom'] : ['top', 'left', 'right']}>
    <View style={{ flex: 1, backgroundColor: resident ? theme.resident.card : theme.background }}>
      <AuthHeader presentation={presentation} title={variant === 'settings' ? 'Set Password' : 'Create Password'} onBack={onBack} />
      <ScrollView contentContainerStyle={{ padding: resident ? 20 : 24, gap: resident ? 20 : 16 }} keyboardShouldPersistTaps="handled">
        <ThemedText type="title" style={resident ? { fontSize: 22, lineHeight: 28 } : undefined}>Create your password</ThemedText>
        <ThemedText themeColor="textSecondary">{variant === 'settings' ? 'Google confirmed it is you. Add a password to also sign in with your email; you can keep using Google.' : required ? 'Finish setting up your account so you can sign in with your email and password.' : 'You can add a password to also sign in with your email, or keep using Google.'}</ThemedText>
        {resident ? <View style={{ gap: 20 }}>{securityFields}</View> : <FormSection icon="lock-closed-outline" title="Account Security">{securityFields}</FormSection>}
        {error && <ThemedText accessibilityLiveRegion="polite" themeColor="accentRed" style={resident ? { color: theme.resident.danger } : undefined}>{error}</ThemedText>}
        <PrimaryButton presentation={presentation} label={uncertain ? 'Check whether this password was saved' : variant === 'settings' ? 'Set password' : required ? 'Create account' : 'Finish account setup'} loading={loading} onPress={() => { void save(uncertain); }} />
        {!required && !uncertain && <PrimaryButton presentation={presentation} label={variant === 'settings' ? 'Cancel' : 'Skip for now'} variant="secondary" disabled={loading} onPress={onSkip} />}
        {error && <PrimaryButton presentation={presentation} label="Recover password" variant="secondary" disabled={loading} onPress={() => {
          if (authSetupRequests.busy) { setError('Please wait for the earlier request to finish before starting recovery.'); return; }
          onDraftChange({ password: '', confirmPassword: '', uncertain: false }); setPasswordRecovery(true); router.replace('/(auth)/forgot-password');
        }} />}
        {variant === 'setup' && <PrimaryButton presentation={presentation} label="Sign out" variant="secondary" disabled={loading} onPress={() => { if (authSetupRequests.busy) setError('The earlier request is still finishing. Please wait before signing out.'); else void logout(); }} />}
      </ScrollView>
    </View>
  </SafeAreaView>;
}
