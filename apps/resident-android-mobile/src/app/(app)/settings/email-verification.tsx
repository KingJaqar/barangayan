import { Ionicons } from '@expo/vector-icons';
import { residentEmailVerification } from '@barangayan/shared';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { AuthHeader } from '@/components/auth-header';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';

type MessageTone = 'success' | 'info' | 'error';

export default function EmailVerificationScreen() {
  const { session } = useAuth();
  // Only the first read blocks the form; a refresh keeps it (and its code entry) mounted.
  const { profile, isInitialLoading, error, refetch } = useProfile();
  const theme = useTheme();
  const owner = session?.user.id;
  if (!owner) return null;
  if (isInitialLoading || error || profile?.id !== owner) {
    return <View style={{ flex: 1, backgroundColor: theme.resident.card }}><AuthHeader presentation="resident" title="Email Verification" />
      <View style={styles.content}><ThemedText themeColor="textSecondary">{error ?? 'Loading your profile…'}</ThemedText>
        {error ? <PrimaryButton presentation="resident" label="Retry" onPress={refetch} /> : null}</View></View>;
  }
  return <EmailVerificationForm key={`${owner}:${profile.email}`} owner={owner}
    email={session.user.email ?? ''} profileEmail={profile.email ?? ''}
    verified={profile.email_verification_status === 'verified'} onVerified={refetch} onRefresh={refetch} />;
}

function EmailVerificationForm({ owner, email, profileEmail, verified, onVerified, onRefresh }: {
  owner: string; email: string; profileEmail: string; verified: boolean; onVerified: () => void; onRefresh: () => Promise<void>;
}) {
  const theme = useTheme();
  const pull = usePullRefresh([onRefresh]);
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: MessageTone } | null>(null);
  const [loading, setLoading] = useState<'send' | 'verify' | null>(null);
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
    setLoading(action);
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
      if (active.current) setLoading(null);
    }
  }

  const successTint = theme.resident.successSoft;
  const toneColor = { success: theme.resident.success, info: theme.resident.accentText, error: theme.resident.danger };
  const toneSurface = { success: successTint, info: theme.resident.accentSoft, error: theme.resident.dangerSoft };
  const toneIcon = { success: 'checkmark-circle', info: 'information-circle', error: 'alert-circle' } as const;

  return <View style={{ flex: 1, backgroundColor: theme.resident.card }}>
    <AuthHeader presentation="resident" title="Email Verification" />
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled"
        refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        <View style={styles.hero}>
          <View style={[styles.heroIcon, { backgroundColor: verified ? successTint : theme.resident.accentSoft }]}>
            <Ionicons name={verified ? 'checkmark-circle' : pending ? 'mail-unread-outline' : 'mail-outline'}
              size={28} color={verified ? theme.resident.success : theme.resident.accentText} />
          </View>
          <ThemedText style={[styles.center, styles.title]} accessibilityRole="header">
            {verified ? 'Email verified' : pending ? 'Check your inbox' : 'Verify your email'}
          </ThemedText>
          <ThemedText type="body" themeColor="textSecondary" style={[styles.center, styles.description]}>
            {verified
              ? 'This address is confirmed for your Barangayan account.'
              : pending
                ? 'Enter the six-digit code we sent. Your current sign-in stays active.'
                : 'We will send a six-digit code to confirm this address belongs to you.'}
          </ThemedText>
        </View>

        <View style={[styles.emailCard, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
          <View style={styles.emailHeader}>
            <View style={styles.emailLabel}>
              <Ionicons name="at" size={18} color={theme.textSecondary} />
              <ThemedText type="small" themeColor="textSecondary">Sign-in email</ThemedText>
            </View>
            <View style={[styles.pill, { backgroundColor: verified ? successTint : theme.resident.surface }]}
              accessibilityLabel={verified ? 'Verified' : 'Not verified'}>
              {verified ? <Ionicons name="checkmark" size={14} color={theme.resident.success} /> : null}
              <ThemedText type="smallBold" style={{ color: verified ? theme.resident.success : theme.resident.muted }}>
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

        {message ? <View style={[styles.banner, { backgroundColor: toneSurface[message.tone], borderColor: toneColor[message.tone] }]}
          accessibilityLiveRegion="polite">
          <Ionicons name={toneIcon[message.tone]} size={20} color={toneColor[message.tone]} />
          <ThemedText type="body" style={styles.bannerText}>{message.text}</ThemedText>
        </View> : null}

        {verified ? <ThemedText type="small" themeColor="textSecondary" style={styles.center}>
          If you change your email in Profile, you will need to verify the new address.
        </ThemedText> : null}

        {matches && !verified ? <View style={styles.actions}>
          {pending ? <>
            <TextField presentation="resident" label="Six-digit code" accessibilityLabel="Email Code" value={code}
              onChangeText={value => setCode(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad"
              autoComplete="one-time-code" textContentType="oneTimeCode" maxLength={6} editable={!loading}
              placeholder="000000" style={styles.codeInput} />
            <PrimaryButton presentation="resident" label="Verify email" accessibilityRole="button" loading={loading === 'verify'}
              disabled={!!loading || code.length !== 6} onPress={() => submit('verify')} />
          </> : null}
          <PrimaryButton presentation="resident" label={loading === 'send' ? 'Sending code…' : remaining ? `Resend in ${remaining}s` : pending ? 'Resend code' : 'Send code'}
            accessibilityRole="button" variant={pending ? 'secondary' : 'primary'}
            loading={loading === 'send'} disabled={!!loading || remaining > 0} onPress={() => submit('send')} />
        </View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  hero: { alignItems: 'center', gap: 6, paddingTop: 4 },
  heroIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  center: { textAlign: 'center' },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800' },
  description: { fontSize: 14.5, lineHeight: 20, maxWidth: 300 },
  emailCard: { gap: 6, borderRadius: 16, borderWidth: 1, padding: 12 },
  emailHeader: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  emailLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  emailText: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, borderRadius: 999, paddingVertical: Spacing.one, paddingHorizontal: Spacing.two + Spacing.one },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 16, borderWidth: 1, padding: 12 },
  bannerText: { flex: 1 },
  actions: { gap: Spacing.three },
  codeInput: { minHeight: 56, fontSize: 24, lineHeight: 32, letterSpacing: 8, textAlign: 'center', fontWeight: '700' },
});
