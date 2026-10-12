import { servicePriceLabel } from '@barangayan/shared';
import { serviceProcessingLabel, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ServicesEmptyState, ServicesErrorState, ServicesListSkeleton } from '@/components/services/services-list-states';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getDocumentIcon } from '@/constants/document-icons';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

/** Real document_types catalog for the resident's own barangay (RLS-scoped). */
export function DocumentsList() {
  const theme = useTheme();
  const [documents, setDocuments] = useState<DocumentType[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  // Each mount gets its own unique channel name so that fast re-mounts (e.g. via
  // router.replace('/services') from the COD confirmation screen) never try to add
  // postgres_changes listeners to a channel that a previous instance already
  // subscribed — Supabase throws "cannot add callbacks after subscribe()" in that case.
  // useState lazy initialiser so Date.now() runs once at mount, not on re-renders.
  // Value is stable (no setter used) — same role as useRef but avoids the purity lint.
  const [channelName] = useState(() => `document-types-${Date.now()}`);

  useEffect(() => {
    let active = true;
    function load() {
      supabase
        .from('document_types')
        .select('*').eq('is_active', true)
        .order('name')
        .then(({ data, error: queryError }) => { if (active) { setDocuments(queryError ? null : data ?? []); setError(queryError ? 'Could not load the service catalog. Reconnect and retry.' : null); } });
    }

    load();

    // Realtime: an admin editing/deactivating a document type on the web dashboard
    // should show up here without a manual pull-to-refresh — same pattern as
    // requests-list.tsx's existing subscription.
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_types' }, load)
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [channelName, retry]);

  if (error) {
    return <ServicesErrorState message={error} retryLabel="Retry catalog" onRetry={() => setRetry(value => value + 1)} />;
  }
  if (documents === null) {
    return <ServicesListSkeleton />;
  }

  if (documents.length === 0) {
    return (
      <ServicesEmptyState
        icon="document-text-outline"
        title="No documents available yet"
        message="Services offered by your barangay will appear here."
      />
    );
  }

  return (
    <View style={styles.list}>
      <View style={styles.sectionHeader}>
        <ThemedText type="heading">Available documents</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {documents.length} {documents.length === 1 ? 'service' : 'services'} from your barangay
        </ThemedText>
      </View>

      {documents.map((doc) => (
        <Link key={doc.id} href={`/services/${doc.id}`} asChild>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={doc.name}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView
              style={[
                styles.card,
                { borderColor: theme.backgroundSelected, shadowColor: theme.text },
              ]}>
              <View style={[styles.iconTile, { backgroundColor: `${theme.primary}1F` }]}>
                <Ionicons name={getDocumentIcon(doc.name)} size={26} color={theme.primary} />
              </View>

              <View style={styles.cardInfo}>
                <ThemedText type="smallBold" style={styles.cardTitle} numberOfLines={2}>
                  {doc.name}
                </ThemedText>
                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={14} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary" style={styles.metaText}>
                    {serviceProcessingLabel(doc)}
                  </ThemedText>
                </View>
                <View style={styles.metaRow}>
                  <Ionicons name="pricetag-outline" size={14} color={theme.primary} />
                  <ThemedText type="smallBold" style={[styles.metaText, { color: theme.primary }]}>
                    {servicePriceLabel(doc)}
                  </ThemedText>
                </View>
              </View>

              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </ThemedView>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: 20,
    paddingTop: Spacing.two,
    gap: Spacing.three,
  },
  sectionHeader: {
    gap: Spacing.half,
    marginBottom: Spacing.one,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },
  iconTile: {
    flexShrink: 0,
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.one,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    flex: 1,
  },
});
