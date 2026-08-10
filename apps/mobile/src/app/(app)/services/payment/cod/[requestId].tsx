import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
};

// State 2a of the payment flow. Cash on Delivery is only ever marked 'paid' by an admin
// at pickup (see the admin Requests board's "Mark Payment Collected" action) — this
// screen just confirms the choice and records amount_centavos on a pending payments row
// so the admin Transactions ledger has something to reconcile against at pickup.
export default function CodConfirmationScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const { data } = await supabase
        .from('service_requests')
        .select('*, document_types(name, fee_centavos)')
        .eq('id', requestId)
        .single();

      if (cancelled || !data) return;
      setRequest(data as ServiceRequest);

      // Idempotent-ish: only create a payments row if one doesn't already exist for
      // this request (e.g. the resident backs out and returns to this screen).
      const fee = (data as ServiceRequest).document_types?.fee_centavos ?? 0;
      const { data: existing } = await supabase
        .from('payments')
        .select('id')
        .eq('service_request_id', requestId)
        .maybeSingle();

      if (!existing) {
        await supabase.from('payments').insert({
          service_request_id: requestId,
          barangay_id: data.barangay_id,
          method: 'cash',
          amount_centavos: fee,
          status: 'pending',
        });
      }
    }

    load();
    return () => {
      cancelled = true;
    };
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
          <View style={[styles.iconCircle, { backgroundColor: `${theme.primary}26` }]}>
            <Ionicons name="cash-outline" size={32} color={theme.primary} />
          </View>
          <ThemedText type="small">Amount Due</ThemedText>
          <ThemedText type="title" style={styles.amount}>
            {fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.notice}>
            {fee === 0
              ? 'This document has no processing fee.'
              : `Pay ${formatCentavosAsPHP(fee)} in cash when you claim this document in your home address.`}
          </ThemedText>
        </ThemedView>
      </View>

      <View style={styles.footer}>
        <PrimaryButton label="View My Requests" onPress={() => router.replace('/services?segment=requests')} />
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
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
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
