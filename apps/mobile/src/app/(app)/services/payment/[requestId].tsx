import { formatCentavosAsPHP, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
};

// Stub for the 30% milestone — no live PayMongo/QR Ph call, per the plan's Month 3
// fallback-tier approach. The design's full QR Ph mockup gets built when the real
// integration lands; residents settle in person at the barangay hall for now.
export default function PaymentScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);

  useEffect(() => {
    supabase
      .from('service_requests')
      .select('*, document_types(name, fee_centavos)')
      .eq('id', requestId)
      .single()
      .then(({ data }) => setRequest(data as ServiceRequest | null));
  }, [requestId]);

  if (request === undefined) {
    return <PlaceholderPanel label="Loading…" />;
  }
  if (request === null) {
    return <PlaceholderPanel label="Request not found." />;
  }

  const fee = request.document_types?.fee_centavos ?? 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {request.document_types?.name ?? 'Document Request'}
        </ThemedText>
        <ThemedText themeColor="textSecondary">Ref #{request.reference_number}</ThemedText>

        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small">Amount Due</ThemedText>
          <ThemedText type="title" style={styles.amount}>
            {fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}
          </ThemedText>
          {fee > 0 ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
              Payment Pending — settle at Barangay Hall. Online payment (QR Ph) is coming
              soon.
            </ThemedText>
          ) : (
            <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
              This document has no processing fee.
            </ThemedText>
          )}
        </ThemedView>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="View My Requests" onPress={() => router.replace('/services')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    fontSize: 24,
  },
  card: {
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  amount: {
    fontSize: 32,
  },
  notice: {
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.four,
  },
});
