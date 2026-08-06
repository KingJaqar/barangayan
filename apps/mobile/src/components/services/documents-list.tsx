import type { Tables } from '@barangayan/shared';
import { formatCentavosAsPHP } from '@barangayan/shared';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

/** Real document_types catalog for the resident's own barangay (RLS-scoped). */
export function DocumentsList() {
  const [documents, setDocuments] = useState<DocumentType[] | null>(null);

  useEffect(() => {
    supabase
      .from('document_types')
      .select('*')
      .order('name')
      .then(({ data }) => setDocuments(data ?? []));
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
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.cardInfo}>
                <ThemedText type="smallBold">{doc.name}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {doc.processing_target_hours <= 24
                    ? '1 Working Day'
                    : `${Math.ceil(doc.processing_target_hours / 24)} Working Days`}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">
                {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
              </ThemedText>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardInfo: {
    gap: Spacing.half,
  },
});
