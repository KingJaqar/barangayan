import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppHeader } from '@/components/app-header';
import { SearchBar } from '@/components/search-bar';
import { SegmentedControl } from '@/components/segmented-control';
import { DocumentsList } from '@/components/services/documents-list';
import { LogsList } from '@/components/services/logs-list';
import { RequestsList } from '@/components/services/requests-list';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';

type ServicesSegment = 'documents' | 'requests' | 'logs';

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
  const [segment, setSegment] = useState<ServicesSegment>('documents');

  return (
    <View style={styles.screen}>
      <AppHeader />

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
        // "Start a new request" — this app's only real entry point for that is picking a
        // document type first via the Documents tab, so the FAB just switches segments
        // back rather than pointing at a screen that doesn't exist. Sibling of
        // ScrollView (not inside RequestsList, which is mounted *inside* it) so it stays
        // fixed at the viewport's bottom-right instead of scrolling away with the list.
        <Pressable
          onPress={() => setSegment('documents')}
          style={[styles.fab, { backgroundColor: theme.primary, bottom: BottomTabInset + Spacing.three }]}
          accessibilityRole="button"
          accessibilityLabel="Start a new document request">
          <Ionicons name="add" size={28} color={theme.onPrimary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
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
    right: Spacing.three,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
});
