import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { idVerificationMessages, idVerificationState } from '@barangayan/shared';
import { useProfile } from '@/hooks/use-profile';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, PullRefreshScope, usePullRefresh } from '@/components/pull-refresh';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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

function isServicesSegment(value: unknown): value is ServicesSegment {
  return value === 'documents' || value === 'requests' || value === 'logs';
}

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
  const { width } = useWindowDimensions();
  const bottomTabInset = useFloatingTabInset();
  const pull = usePullRefresh([refetch]);

  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string | string[] }>();
  const initialSegment: ServicesSegment =
    session && isServicesSegment(segmentParam)
      ? segmentParam
      : 'documents';

  const [segment, setSegment] = useState<ServicesSegment>(initialSegment);
  const [verificationAnchor, setVerificationAnchor] = useState<{ x: number; y: number } | null>(null);
  const verificationButton = useRef<View>(null);
  const signedIn = Boolean(session);
  useFocusEffect(useCallback(() => {
    if (segmentParam === undefined) return;
    if (isServicesSegment(segmentParam)) {
      setVerificationAnchor(null);
      setSegment(signedIn ? segmentParam : 'documents');
    }
    // Consume the entry once. Manual selection and normal tab refocus then stay intact,
    // while another Home entry can request even the same segment again.
    router.setParams({ segment: undefined });
  }, [router, segmentParam, signedIn]));
  const verified = Boolean(session && !error && idVerificationState(profile) === 'verified');
  const verifiedIcon = verified ? (
    <Pressable ref={verificationButton} accessibilityRole="button" accessibilityLabel="Show ID verification status"
      accessibilityState={{ expanded: verificationAnchor !== null }} hitSlop={10} style={styles.verificationButton}
      onPress={event => {
        event.stopPropagation();
        verificationButton.current?.measureInWindow((x, y, _width, height) => setVerificationAnchor({ x, y: y + height + 6 }));
      }}>
      <Image source={require('../../../../assets/images/valid-id-verified.png')} style={styles.verifiedIcon} resizeMode="contain" accessible={false} />
    </Pressable>
  ) : undefined;
  const tabs = (session ? TABS : TABS.slice(0, 1)).map(tab => tab.key === 'documents'
    ? { ...tab, accessory: verifiedIcon, weight: verified ? 1.4 : undefined } : tab);

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
          <SegmentedControl segments={tabs} activeKey={segment} onChange={next => { setVerificationAnchor(null); setSegment(next); }}
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
              {!session || segment === 'documents' ? <DocumentsList /> : null}
              {session && segment === 'logs' && <LogsList />}
            </ScrollView>
          </PullRefreshScope>
        )}

      <ServicesNewRequestButton visible={Boolean(session && segment === 'requests')} bottom={bottomTabInset + 12} onPress={() => setSegment('documents')} />
      </View>
      <Modal transparent visible={verified && verificationAnchor !== null} animationType="none" statusBarTranslucent
        onRequestClose={() => setVerificationAnchor(null)}>
        <View style={StyleSheet.absoluteFill} accessibilityViewIsModal>
          <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss ID verification status"
            onPress={() => setVerificationAnchor(null)} />
          {verificationAnchor ? <View style={[styles.verificationPopover, {
            top: verificationAnchor.y,
            left: Math.max(16, Math.min(verificationAnchor.x - 80, width - 216)),
            maxWidth: width - 32,
            backgroundColor: theme.resident.card,
            borderColor: theme.resident.border,
          }]}>
            <Ionicons name="shield-checkmark" size={20} color={theme.resident.accentText} accessible={false} />
            <ThemedText type="smallBold" style={{ color: theme.resident.accentText, flexShrink: 1 }}>Valid ID verified</ThemedText>
          </View> : null}
        </View>
      </Modal>
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
  verifiedIcon: { width: 22, height: 22 },
  verificationButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  verificationPopover: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12,
    borderRadius: 12, borderWidth: 1, elevation: 6, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
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
