import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, formatDateTime, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

// Reached only from the QR PH flow once usePaymongoSource observes status === 'paid'
// (payment/qrph/[requestId].tsx's redirect). Pay at Pickup never lands here — it has its
// own confirmation screen (payment/pickup/[requestId].tsx) since there's nothing to
// "receive" until pickup.
export default function PaymentSuccessScreen() {
  const { requestId } = useLocalSearchParams<{
    requestId: string;
    refNumber: string;
    amount: string;
    documentFee?: string;
    method: string;
    sourceId?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const [isDownloading, setIsDownloading] = useState(false);
  const [receipt, setReceipt] = useState<(Tables<'payments'> & { service_requests: { reference_number: string } }) | null>(null);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    supabase.from('payments').select('*, service_requests!inner(reference_number)')
      .eq('service_request_id', requestId).eq('status', 'paid').order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setReceipt(data);
        setReceiptError(error || !data ? 'No confirmed payment receipt is available. Reconnect and retry or return to the request.' : null);
      }, () => { if (active) setReceiptError('Could not load the confirmed receipt. Reconnect and retry.'); });
    return () => { active = false; };
  }, [requestId, retry]);
  const amountCentavos = receipt?.amount_centavos ?? 0;
  const paidAt = receipt?.paid_at ?? receipt?.created_at ?? '';
  const refNumber = receipt?.service_requests.reference_number;
  const documentFee = receipt?.document_fee_centavos;
  const method = receipt?.method === 'pickup' ? 'Pay at Pickup' : 'QR PH';
  const sourceId = receipt?.paymongo_payment_id ?? receipt?.paymongo_source_id ?? undefined;

  async function handleDownloadReceipt() {
    setIsDownloading(true);
    try {
      const [{ buildPaymentReceiptHtml }, Print, Sharing, FileSystem] = await Promise.all([
        import('@/lib/payment-receipt-pdf'),
        import('expo-print'),
        import('expo-sharing'),
        // Legacy filesystem API, not the new File/Paths one: in Expo Go, Paths.cache
        // resolves to an experience-isolated directory that Expo Go's bundled Android
        // FileProvider config doesn't recognize, so sharing a URI under it fails with
        // "Not allowed to read file under given URL". FileSystem.cacheDirectory (legacy)
        // is the one directory Expo Go's sharing has reliably supported for years.
        import('expo-file-system/legacy'),
      ]);

      const html = buildPaymentReceiptHtml({
        refNumber: refNumber ?? '—',
        amountLabel: formatCentavosAsPHP(amountCentavos),
        dateTimeLabel: formatDateTime(paidAt),
        method: method ?? 'QR PH',
        documentFeeLabel: documentFee != null ? formatCentavosAsPHP(documentFee) : undefined,
        transactionRef: sourceId,
      });
      const { uri: printedUri } = await Print.printToFileAsync({ html });

      // printToFileAsync is native Android code — it writes straight into the OS-level
      // cache dir, bypassing expo-file-system entirely, so its output isn't under the
      // scoped directory above either. Copying it there first gets the file into the one
      // place Expo Go's FileProvider will actually let expo-sharing read from.
      const fileUri = `${FileSystem.cacheDirectory}barangayan-receipt-${refNumber ?? 'receipt'}.pdf`;
      await FileSystem.copyAsync({ from: printedUri, to: fileUri });

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, { mimeType: 'application/pdf', dialogTitle: 'Save receipt' });
      } else {
        Alert.alert('Receipt Ready', `Your receipt was saved to ${fileUri}`);
      }
    } catch (e: unknown) {
      Alert.alert('Download Failed', e instanceof Error ? e.message : 'Could not download your receipt. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }

  if (!receipt || receipt.service_request_id !== requestId) return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.card }}><ServiceScreenHeader title="Payment receipt" /><View style={{ padding: 20, gap: 16 }}><ThemedText accessibilityRole={receiptError ? 'alert' : undefined}>{receiptError ?? 'Loading confirmed payment receipt…'}</ThemedText><PrimaryButton presentation="resident" label="Retry receipt" onPress={() => setRetry(value => value + 1)}/><PrimaryButton presentation="resident" label="Return to request" variant="secondary" onPress={() => router.replace(`/services/requests/${requestId}`)}/></View></SafeAreaView>;

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.resident.accent }]}>
      <View style={[styles.root, { backgroundColor: theme.resident.card }]}>
        <ServiceScreenHeader title="Payment Successful" />

        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.checkWrap}>
          <View style={[styles.checkGlow, { backgroundColor: theme.resident.accentSoft }]} />
          <View style={[styles.checkOuter, { backgroundColor: theme.resident.accentSoft }]}>
            <View style={[styles.checkInner, { backgroundColor: theme.resident.accent }]}>
              <Ionicons name="checkmark" size={36} color={theme.resident.onAccent} />
            </View>
          </View>
        </View>

        <ThemedText type="title" style={styles.title}>
          Payment Successful
        </ThemedText>
        <ThemedText type="title" style={[styles.amount, { color: theme.resident.accentText }]}>
          {formatCentavosAsPHP(amountCentavos)}
        </ThemedText>

        <View style={[styles.cardShadowWrap, styles.detailsCard]}>
          <Card variant="resident">
            <ThemedText type="small" style={[styles.sectionLabel, styles.detailsHeader]} themeColor="textSecondary">
              Transaction Details
            </ThemedText>
            <Divider />
            <DetailRow label="Ref Number" value={refNumber ?? '—'} />
            <Divider />
            <DetailRow label="Date/Time" value={formatDateTime(paidAt)} />
            <Divider />
            <DetailRow label="Method" value={method ?? 'QR PH'} />
            {documentFee != null ? (
              <>
                <Divider />
                <DetailRow label="Document Fee" value={formatCentavosAsPHP(Number(documentFee))} />
              </>
            ) : null}
            {sourceId ? (
              <>
                <Divider />
                <DetailRow label="Transaction Ref" value={sourceId} />
              </>
            ) : null}
          </Card>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton presentation="resident"
          label="Track My Request →"
          onPress={() => router.replace(`/services/requests/${requestId}`)}
        />
        <PrimaryButton presentation="resident"
          label="Download Receipt ↓"
          variant="secondary"
          loading={isDownloading}
          onPress={handleDownloadReceipt}
        />
        <ThemedText
          type="link"
          style={styles.returnLink}
          onPress={() => router.replace('/home')}>
          Return to Home
        </ThemedText>
      </View>
      </View>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1 },
  content: {
    padding: 20,
    alignItems: 'center',
    gap: 16,
  },

  /* Design-system recipes (shared literally across the Services screens) */
  cardShadowWrap: {
    boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    borderRadius: 16,
    width: '100%',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },

  checkWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  checkGlow: {
    position: 'absolute',
    width: 116,
    height: 116,
    borderRadius: 58,
    top: -18,
    left: -18,
  },
  checkOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24, lineHeight: 30, fontWeight: '800',
  },
  amount: {
    fontSize: 24, lineHeight: 30, fontWeight: '800',
  },
  detailsCard: {
    marginTop: Spacing.three,
  },
  detailsHeader: {
    padding: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16, gap: 8, flexWrap: 'wrap',
  },
  footer: {
    padding: 20,
    gap: Spacing.two,
  },
  returnLink: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
