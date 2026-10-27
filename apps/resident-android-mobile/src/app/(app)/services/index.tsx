import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { idVerificationMessages, idVerificationState } from '@barangayan/shared';
import { useProfile } from '@/hooks/use-profile';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, PullRefreshScope, usePullRefresh } from '@/components/pull-refresh';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentsList } from '@/components/services/documents-list';
import { LogsList } from '@/components/services/logs-list';
import { RequestsList } from '@/components/services/requests-list';
import { ServicesNewRequestButton } from '@/components/services/services-list-presentation';
import { ThemedText } from '@/components/themed-text';
import { SegmentedControl } from '@/components/segmented-control';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

type ServicesSegment = 'documents' | 'requests' | 'logs';

const VALID_SEGMENTS: ServicesSegment[] = ['documents', 'requests', 'logs'];

const TABS: { key: ServicesSegment; label: string }[] = [
  { key: 'documents', label: 'Documents' },
  { key: 'requests', label: 'Requests' },
  { key: 'logs', label: 'Logs' },
];

// Documents/Requests/Logs — confirmed against the design file. Guests only ever see
// Documents (real, guest-readable data per the 0005 migration's anon RLS policy) —
// Requests/Logs require a real identity, so the control that would reach them isn't
// rendered at all for a guest, rather than being reachable-but-gated.
export default function ServicesScreen() {
  const { session } = useAuth();
  const router = useRouter();
  const { profile, refetch, isLoading, error } = useProfile();
  const theme = useTheme();
  const bottomTabInset = useFloatingTabInset();
  const pull = usePullRefresh([refetch]);

  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  const initialSegment: ServicesSegment =
    session && segmentParam && VALID_SEGMENTS.includes(segmentParam as ServicesSegment)
      ? (segmentParam as ServicesSegment)
      : 'documents';

  const [segment, setSegment] = useState<ServicesSegment>(initialSegment);
  const [verificationCollapsed, setVerificationCollapsed] = useState(false);

  const verifiedChip = session && !error && idVerificationState(profile) === 'verified' ? (
    <Pressable accessibilityRole="button" accessibilityLabel={verificationCollapsed ? 'Show ID verification status' : 'Collapse ID verification status'}
      accessibilityState={{ expanded: !verificationCollapsed }} onPress={() => setVerificationCollapsed(value => !value)} style={styles.verificationToggle}>
      {verificationCollapsed ? <Image source={require('../../../../assets/images/valid-id-verified.png')} style={styles.verifiedIcon} resizeMode="contain" accessibilityLabel="Valid ID verified" /> : (
        <View style={[styles.verifiedChip, { backgroundColor: theme.resident.accentSoft }]}>
          <ThemedText type="smallBold" style={[styles.verifiedLabel, { color: theme.resident.accentText }]}>
            {isLoading ? 'Checking ID verification…' : 'Valid ID Verified'}
          </ThemedText>
          <Ionicons name="close" size={16} color={theme.resident.accentText} accessible={false} />
        </View>
      )}
    </Pressable>
  ) : null;

  const statusBlock = (
    <>
      <ProfileCompletionBanner />
      {session && (error || idVerificationState(profile) !== 'verified') ? (
        <View
          style={[
            styles.verifyCard,
            { backgroundColor: theme.resident.card, borderColor: theme.resident.border },
          ]}>
          <View style={styles.verifyHeader}>
            <View style={[styles.verifyIcon, { backgroundColor: theme.resident.accentSoft }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={theme.resident.accentText} />
            </View>
            <ThemedText accessibilityRole="alert" style={styles.verifyText}>
              {isLoading ? 'Checking ID verification…' : error ?? idVerificationMessages[idVerificationState(profile)]}
            </ThemedText>
          </View>
          <PrimaryButton label="Verify Now" presentation="resident" onPress={() => router.push('/settings/valid-id')} />
          {error ? <PrimaryButton label="Retry verification check" presentation="resident" variant="secondary" onPress={refetch} /> : null}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.contentWrapper, { backgroundColor: theme.resident.card }]}>
        <View style={styles.controls}>
          <SegmentedControl segments={session ? TABS : TABS.slice(0, 1)} activeKey={segment} onChange={setSegment}
            variant="underline" presentation="resident" sizing={session ? 'equal' : 'content'} />
        </View>

        {session && segment === 'requests' ? (
          // RequestsList owns its scroller so its filter chips can stay pinned while the
          // list scrolls; the banner/verification block scrolls away above them.
          <RequestsList header={statusBlock} contentContainerStyle={{ paddingBottom: bottomTabInset + 100 }} />
        ) : (
          <PullRefreshScope register={pull.register}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
              contentContainerStyle={[styles.scrollContent, (!session || segment === 'documents') && styles.documentsScrollContent, { paddingBottom: bottomTabInset + 20 }]}>
              {statusBlock}
              {!session || segment === 'documents' ? <DocumentsList verification={verifiedChip} /> : null}
              {session && segment === 'logs' && <LogsList />}
            </ScrollView>
          </PullRefreshScope>
        )}

      <ServicesNewRequestButton visible={Boolean(session && segment === 'requests')} bottom={bottomTabInset + 12} onPress={() => setSegment('documents')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },

  contentWrapper: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: 20,
  },
  scrollContent: {
    paddingTop: 20,
  },
  documentsScrollContent: {
    paddingTop: 6,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  verifiedIcon: { width: 44, height: 44 },
  verifiedLabel: { fontSize: 12, lineHeight: 16 },
  verificationToggle: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  verifyCard: {
    marginHorizontal: 20,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
    borderRadius: 16,
    borderWidth: 1,
  },
  verifyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  verifyIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 21,
  },
});
