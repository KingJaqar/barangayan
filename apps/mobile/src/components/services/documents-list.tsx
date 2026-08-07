import { Ionicons } from '@expo/vector-icons';
import type { Tables } from '@barangayan/shared';
import { formatCentavosAsPHP, formatProcessingTime } from '@barangayan/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
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

  useEffect(() => {
    function load() {
      supabase
        .from('document_types')
        .select('*')
        .order('name')
        .then(({ data }) => setDocuments(data ?? []));
    }

    load();

    // Realtime: an admin editing/deactivating a document type on the web dashboard
    // should show up here without a manual pull-to-refresh — same pattern as
    // requests-list.tsx's existing subscription.
    const channel = supabase
      .channel('document-types')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'document_types' }, load)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (documents === null) {
    return <PlaceholderPanel label="Loading catalog…" />;
  }

  if (documents.length === 0) {
    return <PlaceholderPanel label="No documents available yet." />;
  }

  return (
    <View style={styles.list}>
      {documents.map((doc) => (
        <Link key={doc.id} href={`/services/${doc.id}`} asChild>
          <Pressable>
            <ThemedView style={[styles.card, { borderColor: theme.backgroundSelected }]}>
              <View style={[styles.iconCircle, { backgroundColor: `${theme.primary}26` }]}>
                <Ionicons name={getDocumentIcon(doc.name)} size={20} color={theme.primary} />
              </View>

              <View style={styles.cardInfo}>
                <ThemedText type="smallBold">{doc.name}</ThemedText>
                <View style={styles.processingRow}>
                  <Ionicons name="time-outline" size={12} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatProcessingTime(doc.processing_target_hours)}
                  </ThemedText>
                </View>
              </View>

              {doc.fee_centavos === 0 ? (
                <View style={[styles.pricePill, styles.pricePillFree, { borderColor: theme.textSecondary }]}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Free
                  </ThemedText>
                </View>
              ) : (
                <View style={[styles.pricePill, { backgroundColor: `${theme.primary}26` }]}>
                  <ThemedText type="smallBold" style={{ color: theme.primary }}>
                    {formatCentavosAsPHP(doc.fee_centavos)}
                  </ThemedText>
                </View>
              )}
            </ThemedView>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardInfo: {
    flex: 1,
    gap: Spacing.half,
  },
  processingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pricePill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Spacing.four,
    alignSelf: 'flex-start',
  },
  pricePillFree: {
    borderWidth: 1,
  },
});
