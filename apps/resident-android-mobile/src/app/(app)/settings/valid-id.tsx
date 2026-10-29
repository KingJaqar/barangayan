import { idVerificationState } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, BackHandler, Keyboard, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthHeader } from '@/components/auth-header';
import { GuestPrompt } from '@/components/guest-prompt';
import { RecoveryError } from '@/components/password-recovery-screen';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ResidentIdCaptureStep } from '@/components/resident-id-capture-step';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useIdResubmitLimit } from '@/hooks/use-id-resubmit-limit';
import { useProfile } from '@/hooks/use-profile';
import { useTheme } from '@/hooks/use-theme';
import { ID_REJECTIONS_BEFORE_LOCK, idResubmitWaitLabel } from '@/lib/id-resubmit-limit';

export default function ValidIdScreen() {
  const { session } = useAuth();
  return <ValidIdScreenContent key={session?.user.id ?? 'guest'} />;
}

function ValidIdScreenContent() {
  const router = useRouter();
  const theme = useTheme();
  const { session } = useAuth();
  const { profile, isLoading, error: profileError, refetch } = useProfile();
  const pull = usePullRefresh([refetch]);
  const [submitted, setSubmitted] = useState(false);
  const [replacing, setReplacing] = useState(false);
  const limit = useIdResubmitLimit(session?.user.id ?? null, profile?.current_id_submission_id, profile?.id_verification_status);
  const verification = idVerificationState(profile);
  const verified = !isLoading && !profileError && verification === 'verified';
  const pending = !isLoading && !profileError && verification === 'pending';
  const limited = !replacing && limit.waitMs > 0;
  const checking = isLoading || limit.loading;
  const showConfirmation = !replacing && (submitted || verified || pending);
  const showStatus = showConfirmation || limited || (!replacing && (checking || !!profileError || limit.failed));
  const waitMessage = limit.rejectionLock
    ? `You have used all ${ID_REJECTIONS_BEFORE_LOCK} attempts. You can submit again in ${idResubmitWaitLabel(limit.waitMs)}.`
    : `You can submit a replacement ID in ${idResubmitWaitLabel(limit.waitMs)}.`;

  function goBack() {
    Keyboard.dismiss();
    router.back();
  }
  // The wizard owns hardware back while it is shown; this screen only handles its status views.
  useFocusEffect(useCallback(() => {
    if (!showStatus) return undefined;
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      goBack();
      return true;
    });
    return () => { back.remove(); };
    // goBack only reads the stable router and Keyboard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showStatus]));

  if (!session) return <GuestPrompt label="Log in to submit your valid ID." />;
  if (showStatus) {
    const statusColor = verified ? theme.resident.success : theme.resident.warning;
    return <View style={[styles.root, { backgroundColor: theme.resident.card }]}>
      <AuthHeader presentation="resident" title="Valid ID" onBack={goBack} />
      <SafeAreaView style={styles.root} edges={['left', 'right', 'bottom']}>
        <ScrollView contentContainerStyle={styles.statusContent}
          refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}>
          <View style={styles.statusBody}>
            {showConfirmation ? <View style={[styles.confirmation, { borderColor: theme.resident.border, backgroundColor: verified ? theme.resident.successSoft : theme.resident.warningSoft }]} accessibilityLiveRegion="polite">
              <Ionicons name={verified ? "checkmark-circle-outline" : "time-outline"} size={20} color={statusColor} />
              <View style={styles.statusText}>
                <ThemedText style={styles.confirmationTitle}>{verified ? 'Your valid ID has been verified' : 'Valid ID is pending verification'}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{verified ? 'You can use this ID for service requests.' : 'Your ID has been submitted for staff review. You can use it for service requests once it has been verified.'}</ThemedText>
              </View>
            </View> : null}
            {checking ? <View style={styles.status} accessibilityLiveRegion="polite"><ActivityIndicator color={theme.resident.accentText} /><ThemedText themeColor="textSecondary">Checking verification status…</ThemedText></View> : profileError ? <>
              <RecoveryError presentation="resident" message={submitted ? 'Your ID was submitted. Verification status is temporarily unavailable.' : profileError} />
              <PrimaryButton presentation="resident" label="Try again" onPress={() => { refetch(); limit.retry(); }} />
            </> : limit.failed ? <>
              <RecoveryError presentation="resident" message="Could not check when you can submit another ID. Reconnect and try again." />
              <PrimaryButton presentation="resident" label="Try again" onPress={limit.retry} />
            </> : showConfirmation ? <>
              <ThemedText type="small" themeColor="textSecondary">{verified ? 'If you need to replace this ID, your new submission will require staff verification before it can be used for service requests.' : 'If you need to correct this submission, you can submit a replacement ID for staff review.'}</ThemedText>
              <PrimaryButton presentation="resident" variant="secondary" label="Submit a replacement ID" disabled={limited} leadingIcon={<Ionicons name="card-outline" size={20} color={limited ? theme.resident.muted : theme.resident.text} />} onPress={() => { if (limit.blocked()) return; setSubmitted(false); setReplacing(true); }} />
              {limited ? <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">{waitMessage}</ThemedText> : null}
            </> : limited ? <View style={[styles.confirmation, { borderColor: theme.resident.border, backgroundColor: theme.resident.warningSoft }]} accessibilityLiveRegion="polite">
              <Ionicons name="time-outline" size={20} color={theme.resident.warning} />
              <View style={styles.statusText}>
                <ThemedText style={styles.confirmationTitle}>Your ID has not been verified</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">{waitMessage}</ThemedText>
              </View>
            </View> : null}
            <PrimaryButton presentation="resident" label="Back to Settings" onPress={() => router.dismissTo('/settings')} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>;
  }
  return <ResidentIdCaptureStep
    exitLabel="Back to Settings"
    onExit={() => router.back()}
    onSubmitted={() => { limit.markSubmitted(); setSubmitted(true); setReplacing(false); refetch(); }}
    currentStatus={profile?.id_verification_status ? { status: profile.id_verification_status, verified } : undefined}
  />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  statusContent: { flexGrow: 1, padding: 16 },
  statusBody: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 16 },
  confirmation: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderWidth: 1, borderRadius: 16 },
  confirmationTitle: { fontSize: 16, lineHeight: 20, fontWeight: '700', marginBottom: 4 },
  status: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  statusText: { flex: 1 },
});
