import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Image } from 'expo-image';
import { SearchBar } from '@/components/search-bar';
import { SegmentedControl } from '@/components/segmented-control';
import { DocumentsList } from '@/components/services/documents-list';
import { LogsList } from '@/components/services/logs-list';
import { RequestsList } from '@/components/services/requests-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

type ServicesSegment = 'documents' | 'requests' | 'logs';

const VALID_SEGMENTS: ServicesSegment[] = ['documents', 'requests', 'logs'];

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
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const { segment: segmentParam } = useLocalSearchParams<{ segment?: string }>();
  const initialSegment: ServicesSegment =
    session && segmentParam && VALID_SEGMENTS.includes(segmentParam as ServicesSegment)
      ? (segmentParam as ServicesSegment)
      : 'documents';

  const [segment, setSegment] = useState<ServicesSegment>(initialSegment);

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
        <SearchBar placeholder={SEARCH_PLACEHOLDER[segment]} />

        {session ? (
          <SegmentedControl
            segments={[
              { key: 'documents', label: 'Documents' },
              { key: 'requests', label: 'Requests' },
              { key: 'logs', label: 'Logs' },
            ]}
            activeKey={segment}
            onChange={setSegment}
            variant="outline"
          />
        ) : (
          // A single reachable segment doesn't need (or visually match) the generic
          // SegmentedControl — that component's segments are flex:1/stretch, so one item
          // would render as a full-width pill, not the compact label the design shows.
          <ThemedView type="backgroundElement" style={styles.guestTrack}>
            <View style={[styles.guestPill, { backgroundColor: theme.background }]}>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                Documents
              </ThemedText>
            </View>
          </ThemedView>
        )}
      </View>

      <ScrollView>
        {!session || segment === 'documents' ? <DocumentsList /> : null}
        {session && segment === 'requests' && <RequestsList />}
        {session && segment === 'logs' && <LogsList />}
      </ScrollView>

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
          <Ionicons name="add" size={30} color="#FFFFFF" />
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
    padding: Spacing.three,
    gap: Spacing.three,
  },
  guestTrack: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.four,
    padding: Spacing.half,
  },
  guestPill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
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
