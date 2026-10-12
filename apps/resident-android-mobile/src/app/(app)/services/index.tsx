import { ProfileCompletionBanner } from '@/components/profile-completion-banner';
import { idVerificationMessages, idVerificationState } from '@barangayan/shared';
import { useProfile } from '@/hooks/use-profile';
import { PrimaryButton } from '@/components/primary-button';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { DocumentsList } from '@/components/services/documents-list';
import { LogsList } from '@/components/services/logs-list';
import { RequestsList } from '@/components/services/requests-list';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

type ServicesSegment = 'documents' | 'requests' | 'logs';

const VALID_SEGMENTS: ServicesSegment[] = ['documents', 'requests', 'logs'];

const TABS: { key: ServicesSegment; label: string }[] = [
  { key: 'documents', label: 'Documents' },
  { key: 'requests', label: 'Requests' },
  { key: 'logs', label: 'Logs' },
];

const SEARCH_PLACEHOLDER: Record<ServicesSegment, string> = {
  documents: 'Search documents...',
  requests: 'Search requests...',
  logs: 'Search logs...',
};

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
  const insets = useSafeAreaInsets();

  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  const initialSegment: ServicesSegment =
    session && segmentParam && VALID_SEGMENTS.includes(segmentParam as ServicesSegment)
      ? (segmentParam as ServicesSegment)
      : 'documents';

  const [segment, setSegment] = useState<ServicesSegment>(initialSegment);

  const statusBlock = (
    <>
      <ProfileCompletionBanner />
      {session && !isLoading && !error && idVerificationState(profile) === 'verified' ? (
        <View style={[styles.verifiedChip, { backgroundColor: `${theme.primary}1A` }]}>
          <Ionicons name="shield-checkmark" size={18} color={theme.primary} />
          <ThemedText type="smallBold" style={{ color: theme.primary }}>
            Valid ID Verified
          </ThemedText>
        </View>
      ) : null}
      {session && (isLoading || error || idVerificationState(profile) !== 'verified') ? (
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
          <PrimaryButton label="Verify Now" onPress={() => router.push('/settings/profile?focus=id')} />
          {error ? <PrimaryButton label="Retry verification check" variant="secondary" onPress={refetch} /> : null}
        </View>
      ) : null}
    </>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two },
        ]}
      >
        <View style={styles.headerContent}>
          <Image
            source={require('@/assets/logo/barangayan-logo-1024.png')}
            style={styles.headerLogo}
            contentFit="contain"
          />
          <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Barangayan
          </ThemedText>
        </View>
      </View>
      <View style={[styles.contentWrapper, { backgroundColor: theme.background }]}>
        <View style={styles.controls}>
          <View
            style={[
              styles.search,
              {
                backgroundColor: theme.background,
                borderColor: theme.backgroundSelected,
                shadowColor: theme.text,
              },
            ]}>
            <Ionicons name="search" size={20} color={theme.text} />
            <TextInput
              placeholder={SEARCH_PLACEHOLDER[segment]}
              placeholderTextColor={theme.textSecondary}
              accessibilityLabel={SEARCH_PLACEHOLDER[segment]}
              style={[styles.searchInput, { color: theme.text }]}
            />
          </View>

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
          <RequestsList header={statusBlock} contentContainerStyle={styles.scrollContent} />
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}>
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
            { backgroundColor: theme.primary, bottom: 28 },
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
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: Fonts.gideonRoman,
  },
  contentWrapper: {
    flex: 1,
  },
  controls: {
    paddingHorizontal: 20,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    height: 52,
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
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
