import type { Tables } from '@barangayan/shared';
import { formatCentavosAsPHP } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

export default function DocumentDetailScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const [doc, setDoc] = useState<DocumentType | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from('document_types')
      .select('*')
      .eq('id', documentId)
      .single()
      .then(({ data }) => setDoc(data));
  }, [documentId]);

  if (doc === undefined) {
    return <PlaceholderPanel label="Loading…" />;
  }
  if (doc === null) {
    return <PlaceholderPanel label="Document not found." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {doc.name}
        </ThemedText>
        <ThemedText type="smallBold">
          {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
        </ThemedText>

        {doc.description ? (
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {doc.description}
          </ThemedText>
        ) : null}

        {doc.requirements.length > 0 ? (
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">Requirements</ThemedText>
            {doc.requirements.map((req) => (
              <ThemedText key={req} type="small" themeColor="textSecondary">
                • {req}
              </ThemedText>
            ))}
          </ThemedView>
        ) : null}

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="smallBold">Processing & Pickup</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Estimated time: {Math.ceil(doc.processing_target_hours / 24)} Working Day
            {doc.processing_target_hours > 24 ? 's' : ''}
          </ThemedText>
        </ThemedView>
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Request This Document"
          onPress={() => router.push(`/services/request/${doc.id}`)}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 26,
  },
  description: {
    marginTop: Spacing.two,
  },
  section: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
    marginTop: Spacing.three,
  },
  footer: {
    padding: Spacing.four,
  },
});
