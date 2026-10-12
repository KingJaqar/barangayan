import { Ionicons } from '@expo/vector-icons';
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

type MessageTone = 'success' | 'info' | 'error';

export default function EmailVerificationScreen() {
  const { session } = useAuth();
  const { profile, isLoading, error, refetch } = useProfile();
  const theme = useTheme();
  const owner = session?.user.id;
  if (!owner) return null;
  if (isLoading || error || profile?.id !== owner) {
    return <View style={{ flex: 1, backgroundColor: theme.background }}><AuthHeader title="Email Verification" />
      <View style={styles.content}><ThemedText themeColor="textSecondary">{error ?? 'Loading your profile…'}</ThemedText>
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
  const [message, setMessage] = useState<{ text: string; tone: MessageTone } | null>(null);
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
    setMessage(null);
    if (action === 'send') { setCode(''); setDeadline(Date.now() + 60000); setNow(Date.now()); }
    try {
      const state = await residentEmailVerification(supabase, owner, action, code);
      if (!active.current) return;
      if (state === 'verified') {
        setCode(''); setMessage({ text: 'Your email is verified.', tone: 'success' }); onVerified();
      } else { setPending(true); setMessage({ text: 'A six-digit code was sent to your sign-in email.', tone: 'info' }); }
    } catch (failure) {
      if (active.current) setMessage({ text: failure instanceof Error ? failure.message : 'Unable to verify your email. Please retry.', tone: 'error' });
    } finally {
      busy.current = false;
      if (active.current) setLoading(false);
    }
  }

  // Flat tints derived from the fixed status colors (8-digit hex = color + alpha).
  const successTint = `${theme.accentGreen}1F`;
  const toneColor = { success: theme.accentGreen, info: theme.primary, error: theme.accentRed };
  const toneIcon = { success: 'checkmark-circle', info: 'information-circle', error: 'alert-circle' } as const;

  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <AuthHeader title="Email Verification" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: verified ? successTint : theme.backgroundElement }]}>
            <Ionicons name={verified ? 'checkmark-circle' : pending ? 'mail-unread-outline' : 'mail-outline'}
              size={40} color={verified ? theme.accentGreen : theme.primary} />
          </View>
          <ThemedText type="heading" style={styles.center} accessibilityRole="header">
            {verified ? 'Email verified' : pending ? 'Check your inbox' : 'Verify your email'}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={styles.center}>
            {verified
              ? 'This address is confirmed for your Barangayan account.'
              : pending
                ? 'Enter the six-digit code we sent. Your current sign-in stays active.'
                : 'We will send a six-digit code to confirm this address belongs to you.'}
          </ThemedText>
        </View>

        <View style={[styles.emailCard, { backgroundColor: theme.backgroundElement }]}>
          <View style={styles.emailHeader}>
            <View style={styles.emailLabel}>
              <Ionicons name="at" size={18} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">Sign-in email</ThemedText>
            </View>
            <View style={[styles.pill, { backgroundColor: verified ? successTint : theme.backgroundSelected }]}
              accessibilityLabel={verified ? 'Verified' : 'Not verified'}>
              {verified ? <Ionicons name="checkmark" size={14} color={theme.accentGreen} /> : null}
              <ThemedText type="smallBold" style={{ color: verified ? theme.accentGreen : theme.textSecondary }}>
                {verified ? 'Verified' : 'Not verified'}
              </ThemedText>
            </View>
          </View>
          {/* Full address, wrapped rather than truncated so residents can check every character. */}
          <ThemedText type="body" style={styles.emailText} selectable>{email}</ThemedText>
        </View>

        {!matches ? <ThemedText type="body" themeColor="textSecondary">
          Save your sign-in email in Profile before verifying it.
        </ThemedText> : null}

        {message ? <View style={[styles.banner, { backgroundColor: theme.backgroundElement, borderLeftColor: toneColor[message.tone] }]}
          accessibilityLiveRegion="polite">
          <Ionicons name={toneIcon[message.tone]} size={20} color={toneColor[message.tone]} />
          <ThemedText type="body" style={styles.bannerText}>{message.text}</ThemedText>
        </View> : null}

        {verified ? <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          If you change your email in Profile, you will need to verify the new address.
        </ThemedText> : null}

        {matches && !verified ? <View style={styles.actions}>
          {pending ? <>
            <TextField label="Verification code" accessibilityLabel="Email Code" value={code}
              onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
              autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} editable={!loading}
              placeholder="000000" style={styles.codeInput} />
            <PrimaryButton label="Verify email" accessibilityRole="button" loading={loading}
              disabled={code.length !== 6} onPress={() => submit('verify')} />
          </> : null}
          <PrimaryButton label={remaining ? `Resend in ${remaining}s` : pending ? 'Resend code' : 'Send code'}
            accessibilityRole="button" variant={pending ? 'secondary' : 'primary'}
            loading={loading && !pending} disabled={loading || remaining > 0} onPress={() => submit('send')} />
        </View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.four, paddingBottom: Spacing.six },
  hero: { alignItems: 'center', gap: Spacing.two, paddingTop: Spacing.three },
  heroIcon: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.two },
  center: { textAlign: 'center' },
  emailCard: { gap: Spacing.two, borderRadius: 16, padding: Spacing.three },
  emailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  emailLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  emailText: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, borderRadius: 999, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two + Spacing.one },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderRadius: 12, borderLeftWidth: 4, padding: Spacing.three },
  bannerText: { flex: 1 },
  actions: { gap: Spacing.three },
  codeInput: { fontSize: 24, letterSpacing: 8, textAlign: 'center', fontWeight: '600' },
});
