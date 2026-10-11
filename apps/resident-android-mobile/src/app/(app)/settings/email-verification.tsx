import { residentEmailVerification } from '@barangayan/shared';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AuthHeader } from '@/components/auth-header';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

export default function EmailVerificationScreen() {
  const { session } = useAuth();
  const { profile, isLoading, error, refetch } = useProfile();
  const owner = session?.user.id;
  if (!owner) return null;
  if (isLoading || error || profile?.id !== owner) {
    return <View style={{ flex: 1 }}><AuthHeader title="Email Verification" />
      <View style={styles.content}><ThemedText>{error ?? 'Loading your profile…'}</ThemedText>
        {error ? <PrimaryButton label="Retry" onPress={refetch} /> : null}</View></View>;
  }
  return <EmailVerificationForm key={`${owner}:${profile.email}`} owner={owner}
    email={session.user.email ?? ''} profileEmail={profile.email ?? ''}
    verified={profile.email_verification_status === 'verified'} onVerified={refetch} />;
}

function EmailVerificationForm({ owner, email, profileEmail, verified, onVerified }: {
  owner: string; email: string; profileEmail: string; verified: boolean; onVerified: () => void;
}) {
  const theme = useTheme();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now);
  const active = useRef(true);
  const busy = useRef(false);
  const remaining = Math.max(0, Math.ceil((deadline - now) / 1000));
  const matches = !!email && email.trim().toLowerCase() === profileEmail.trim().toLowerCase();
  useEffect(() => {
    active.current = true;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { active.current = false; clearInterval(timer); };
  }, []);

  async function submit(action: 'send' | 'verify') {
    if (busy.current || !matches || verified || (action === 'send' && remaining > 0)) return;
    busy.current = true;
    setLoading(true);
    setMessage('');
    if (action === 'send') { setCode(''); setDeadline(Date.now() + 60000); setNow(Date.now()); }
    try {
      const state = await residentEmailVerification(supabase, owner, action, code);
      if (!active.current) return;
      if (state === 'verified') {
        setCode(''); setMessage('Your email is verified.'); onVerified();
      } else { setPending(true); setMessage('A six-digit code was sent to your sign-in email.'); }
    } catch (failure) {
      if (active.current) setMessage(failure instanceof Error ? failure.message : 'Unable to verify your email. Please retry.');
    } finally {
      busy.current = false;
      if (active.current) setLoading(false);
    }
  }
  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <AuthHeader title="Email Verification" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <ThemedText type="heading">{verified ? 'Your email is verified' : 'Verify your email'}</ThemedText>
        <ThemedText>{email}</ThemedText>
        {!matches ? <ThemedText>Save your sign-in email in Profile before verifying it.</ThemedText> : null}
        {message ? <ThemedText accessibilityLiveRegion="polite">{message}</ThemedText> : null}
        {matches && !verified ? <>
          <ThemedText>Use the code sent to this address. Your existing sign-in stays active.</ThemedText>
          {pending ? <><TextField label="Email Code" accessibilityLabel="Email Code" value={code}
            onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
            autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} editable={!loading} />
            <PrimaryButton label="Verify email" accessibilityRole="button" loading={loading}
              disabled={code.length !== 6} onPress={() => submit('verify')} /></> : null}
          <PrimaryButton label={remaining ? `Resend in ${remaining}s` : pending ? 'Resend code' : 'Send code'}
            accessibilityRole="button" variant={pending ? 'secondary' : 'primary'}
            disabled={loading || remaining > 0} onPress={() => submit('send')} />
        </> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}
const styles = StyleSheet.create({ content: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six } });
