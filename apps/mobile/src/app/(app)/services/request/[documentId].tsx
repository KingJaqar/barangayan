import { formatCentavosAsPHP, requestFormSchema, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/hooks/use-auth';
import { useProfile } from '@/hooks/use-profile';
import { supabase } from '@/lib/supabase';

type DocumentType = Tables<'document_types'>;

export default function RequestFormScreen() {
  const { documentId } = useLocalSearchParams<{ documentId: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { profile } = useProfile();

  const [doc, setDoc] = useState<DocumentType | null | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('document_types').select('*').eq('id', documentId).single().then(({ data }) => setDoc(data));
  }, [documentId]);

  async function handleSubmit() {
    if (!doc || !session) return;
    setError(null);

    const result = requestFormSchema.safeParse({
      documentTypeId: doc.id,
      requesterNotes: notes || undefined,
    });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    setSubmitting(true);
    const { data, error: insertError } = await supabase
      .from('service_requests')
      .insert({
        barangay_id: doc.barangay_id,
        resident_id: session.user.id,
        document_type_id: doc.id,
        requester_notes: result.data.requesterNotes ?? null,
      })
      .select()
      .single();
    setSubmitting(false);

    if (insertError || !data) {
      setError(insertError?.message ?? 'Could not submit request.');
      return;
    }

    router.replace(`/services/payment/${data.id}`);
  }

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
          Request Form
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="small">Purpose of Request</ThemedText>
          <TextField
            placeholder="e.g. Employment requirement"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.section}>
          <View style={styles.rowBetween}>
            <ThemedText type="smallBold">Resident Details</ThemedText>
            <ThemedText type="link" onPress={() => router.push('/settings/profile')}>
              Edit in Profile
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary">
            {profile?.full_name ?? '—'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {profile?.home_address ?? 'No address on file'}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {profile?.mobile_number ?? 'No mobile number on file'}
          </ThemedText>
        </ThemedView>

        {/* Real file upload (Supabase Storage bucket + RLS) is deferred — same
            simplification as Register's Location Verification step. */}
        <ThemedView type="backgroundElement" style={styles.section}>
          <ThemedText type="small">Valid ID Upload</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Please upload a clear copy of a government-issued ID. (Coming soon — bring a
            physical copy to the barangay hall for now.)
          </ThemedText>
        </ThemedView>

        <View style={styles.feeRow}>
          <ThemedText type="small">Processing Fee</ThemedText>
          <ThemedText type="smallBold">
            {doc.fee_centavos === 0 ? 'Free' : formatCentavosAsPHP(doc.fee_centavos)}
          </ThemedText>
        </View>

        {error ? (
          <ThemedText type="small" themeColor="accentRed">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton label="Proceed to Payment" loading={submitting} onPress={handleSubmit} />
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
    gap: Spacing.three,
  },
  title: {
    fontSize: 26,
  },
  section: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.two,
  },
  footer: {
    padding: Spacing.four,
  },
});
