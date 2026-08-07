import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, formatProcessingTime, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Collapsible } from '@/components/ui/collapsible';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

export default function DocumentDetailScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const theme = useTheme();
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
        <ThemedView type="backgroundElement" style={styles.illustration}>
          <Ionicons name="document-text-outline" size={72} color={theme.textSecondary} />
        </ThemedView>

        <View style={styles.titleRow}>
          <ThemedText type="title" style={styles.title}>
            {doc.name}
          </ThemedText>
          <View style={[styles.feePill, { backgroundColor: `${theme.primary}26` }]}>
            <ThemedText type="smallBold" style={{ color: theme.primary }}>
              {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
            </ThemedText>
          </View>
        </View>

        {doc.description ? (
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {doc.description}
          </ThemedText>
        ) : null}

        {doc.requirements.length > 0 ? (
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="checkmark-done-outline" size={18} color={theme.primary} />
              <ThemedText type="smallBold">Requirements</ThemedText>
            </View>
            <Divider />
            {doc.requirements.map((req, index) => (
              <View key={req}>
                <View style={styles.requirementRow}>
                  <Ionicons name="ellipse-outline" size={16} color={theme.textSecondary} />
                  <ThemedText type="small" style={styles.requirementText}>
                    {req}
                  </ThemedText>
                </View>
                {index < doc.requirements.length - 1 ? <Divider /> : null}
              </View>
            ))}
          </Card>
        ) : null}

        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={18} color={theme.primary} />
            <ThemedText type="smallBold">Processing & Pickup</ThemedText>
          </View>
          <Divider />
          <View style={styles.processingRow}>
            <ThemedText type="small" themeColor="textSecondary">
              Estimated Time
            </ThemedText>
            <ThemedText type="smallBold">{formatProcessingTime(doc.processing_target_hours)}</ThemedText>
          </View>
        </Card>

        <Collapsible title="Additional Notes">
          <ThemedText type="small" themeColor="textSecondary">
            Please ensure all requirements are complete before proceeding. Bring the
            original documents for verification at the Barangay Hall. Processing times
            are estimates and may vary during peak periods.
          </ThemedText>
        </Collapsible>
      </ScrollView>

      <View style={styles.footer}>
        {session ? (
          <PrimaryButton
            label="Request This Document"
            onPress={() => router.push(`/services/request/${doc.id}`)}
          />
        ) : (
          // Submitting a request requires an identity — guests get routed to Login
          // instead of the Request Form.
          <PrimaryButton label="Log In to Request" onPress={() => router.push('/(auth)/login')} />
        )}
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
  illustration: {
    height: 180,
    borderRadius: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    fontSize: 26,
    flex: 1,
  },
  feePill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  description: {
    marginTop: Spacing.one,
  },
  card: {
    marginTop: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  requirementRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  requirementText: {
    flex: 1,
  },
  processingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  footer: {
    padding: Spacing.four,
  },
});
