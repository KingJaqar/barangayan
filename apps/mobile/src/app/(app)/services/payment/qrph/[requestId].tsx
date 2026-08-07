import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, type Tables } from '@barangayan/shared';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Animated, SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { CountdownTimer } from '@/components/services/countdown-timer';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { usePaymongoSource } from '@/hooks/use-paymongo-source';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
};

const BANK_ICONS = ['business-outline', 'wallet-outline', 'card-outline', 'qr-code-outline', 'phone-portrait-outline'] as const;

// State 2b of the payment flow. Only reachable once PAYMENT_SETTLEMENT_READY is true —
// see constants/payment.ts and the plan's Part G for the settlement-account gating this
// screen assumes is already satisfied by the time a resident lands here.
export default function QrPhPaymentScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    supabase
      .from('service_requests')
      .select('*, document_types(name, fee_centavos)')
      .eq('id', requestId)
      .single()
      .then(({ data }) => setRequest(data as ServiceRequest | null));
  }, [requestId]);

  const fee = request?.document_types?.fee_centavos ?? 0;
  const { source, status } = usePaymongoSource(
    requestId,
    fee,
    request?.document_types?.name ?? 'Document Request',
  );

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (status === 'paid' && request) {
      router.replace({
        pathname: '/services/payment/success',
        params: {
          requestId,
          refNumber: request.reference_number,
          amount: String(fee),
          method: 'QR Ph',
        },
      });
    }
  }, [status, request, requestId, fee, router]);

  if (request === undefined) {
    return <PlaceholderPanel label="Loading…" />;
  }
  if (request === null) {
    return <PlaceholderPanel label="Request not found." />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedView type="backgroundElement" style={styles.header}>
          <ThemedText type="small">Payment for</ThemedText>
          <ThemedText type="smallBold">{request.document_types?.name ?? 'Document Request'}</ThemedText>
          <ThemedText type="title" style={[styles.amount, { color: theme.primary }]}>
            {fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}
          </ThemedText>
          {source ? <CountdownTimer expiresAt={source.expiresAt} /> : null}
        </ThemedView>

        <ThemedView type="backgroundElement" style={styles.qrCard}>
          {status === 'loading' || !source ? (
            <PlaceholderPanel label="Generating your QR code…" />
          ) : status === 'error' ? (
            <ThemedText type="small" themeColor="accentRed">
              Could not start a QR Ph payment. Please try again.
            </ThemedText>
          ) : status === 'expired' ? (
            <ThemedText type="small" themeColor="accentRed">
              This QR code has expired. Go back and try again.
            </ThemedText>
          ) : (
            <>
              <Image source={{ uri: source.qrImageUrl }} style={styles.qrImage} contentFit="contain" />
              <ThemedText type="small" themeColor="textSecondary" style={styles.qrCaption}>
                Scan with any participating bank or e-wallet app via QR Ph.
              </ThemedText>
            </>
          )}
        </ThemedView>

        <View style={styles.bankRow}>
          {BANK_ICONS.map((icon) => (
            <Ionicons key={icon} name={icon} size={22} color={theme.textSecondary} />
          ))}
        </View>

        {status === 'pending' ? (
          <View style={styles.waitingRow}>
            <Animated.View style={[styles.dot, { backgroundColor: theme.primary, opacity: pulse }]} />
            <View>
              <ThemedText type="smallBold" style={{ color: theme.primary }}>
                Waiting for payment...
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Do not close this screen while paying. It will automatically update once
                payment is received.
              </ThemedText>
            </View>
          </View>
        ) : null}
      </ScrollView>
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
  header: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  amount: {
    fontSize: 32,
    marginVertical: Spacing.one,
  },
  qrCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 280,
    justifyContent: 'center',
  },
  qrImage: {
    width: 220,
    height: 220,
  },
  qrCaption: {
    textAlign: 'center',
  },
  bankRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  waitingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: Spacing.one,
  },
});
