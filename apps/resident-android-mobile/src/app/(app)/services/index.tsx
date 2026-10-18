import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { idVerificationMessages, idVerificationState } from '@barangayan/shared';
import { useProfile } from '@/hooks/use-profile';
import { PrimaryButton } from '@/components/primary-button';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentsList } from '@/components/services/documents-list';
import { LogsList } from '@/components/services/logs-list';
import { RequestsList } from '@/components/services/requests-list';
import { ThemedText } from '@/components/themed-text';
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
  useFocusEffect(useCallback(() => { if (session) refetch(); }, [refetch, session]));
  const theme = useTheme();
  const bottomTabInset = useFloatingTabInset();

  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  const initialSegment: ServicesSegment =
    session && segmentParam && VALID_SEGMENTS.includes(segmentParam as ServicesSegment)
      ? (segmentParam as ServicesSegment)
      : 'documents';

  const [segment, setSegment] = useState<ServicesSegment>(initialSegment);

  const statusBlock = (
    <>
      <ProfileCompletionBanner />
      {/* Keep an already-verified profile's compact status while focus refreshes it.
          Expanding it into the verification card on every tab visit moves the list
          down and back up. Pending text is informational; action guards still use
          the profile's loading/error state. */}
      {session && !error && idVerificationState(profile) === 'verified' ? (
        <View style={[styles.verifiedChip, { backgroundColor: `${theme.primary}1A` }]}>
          <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            {isLoading ? 'Checking ID verification…' : 'Valid ID Verified'}
          </ThemedText>
        </View>
      ) : null}
      {session && (error || idVerificationState(profile) !== 'verified') ? (
        <View
          style={[
            styles.verifyCard,
            { backgroundColor: theme.background, borderColor: theme.backgroundSelected, shadowColor: theme.text },
          ]}>
          <View style={styles.verifyHeader}>
            <View style={[styles.verifyIcon, { backgroundColor: `${theme.primary}1F` }]}>
              <Ionicons name="shield-checkmark-outline" size={24} color={theme.primary} />
            </View>
            <ThemedText accessibilityRole="alert" style={styles.verifyText}>
              {isLoading ? 'Checking ID verification…' : error ?? idVerificationMessages[idVerificationState(profile)]}
            </ThemedText>
          </View>
          <PrimaryButton label="Verify Now" onPress={() => router.push('/settings/valid-id')} />
          {error ? <PrimaryButton label="Retry verification check" variant="secondary" onPress={refetch} /> : null}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.contentWrapper, { backgroundColor: theme.background }]}>
        <View style={styles.controls}>
          <View style={[styles.tabs, { borderBottomColor: theme.backgroundSelected }]}>
            {(session ? TABS : TABS.slice(0, 1)).map((tab) => {
              const isActive = tab.key === segment;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setSegment(tab.key)}
                  accessibilityRole="tab"
                  accessibilityLabel={tab.label}
                  accessibilityState={{ selected: isActive }}
                  style={[styles.tab, session ? styles.tabFlex : styles.tabGuest]}>
                  <ThemedText
                    type="smallBold"
                    style={[
                      styles.tabLabel,
                      { color: isActive ? theme.text : theme.textSecondary },
                    ]}>
                    {tab.label}
                  </ThemedText>
                  <View
                    style={[
                      styles.tabIndicator,
                      { backgroundColor: isActive ? theme.primary : 'transparent' },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>

        {session && segment === 'requests' ? (
          // RequestsList owns its scroller so its filter chips can stay pinned while the
          // list scrolls; the banner/verification block scrolls away above them.
          <RequestsList header={statusBlock} contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomTabInset + 120 }]} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomTabInset + 120 }]}>
            {statusBlock}
            {!session || segment === 'documents' ? <DocumentsList /> : null}
            {session && segment === 'logs' && <LogsList />}
          </ScrollView>
        )}

      {session && segment === 'requests' ? (
        <Pressable
          onPress={() => setSegment('documents')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: theme.primary, bottom: bottomTabInset + 28 },
            pressed && styles.fabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Start a new document request">
          <Ionicons name="add" size={22} color={theme.onPrimary} />
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            New request
          </ThemedText>
        </Pressable>
      ) : null}
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
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  tabFlex: {
    flex: 1,
  },
  tabGuest: {
    paddingHorizontal: Spacing.three,
  },
  tabLabel: {
    fontSize: 15,
    paddingBottom: Spacing.two,
  },
  tabIndicator: {
    height: 3,
    alignSelf: 'stretch',
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  scrollContent: {
    paddingTop: Spacing.three,
    paddingBottom: 120,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    alignSelf: 'flex-start',
    marginHorizontal: 20,
    marginBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: 20,
  },
  verifyCard: {
    marginHorizontal: 20,
    marginBottom: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.three,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
  fab: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    gap: Spacing.two,
    height: 56,
    paddingHorizontal: 20,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.96 }],
  },
});
