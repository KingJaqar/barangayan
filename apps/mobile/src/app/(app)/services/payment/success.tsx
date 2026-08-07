import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, formatDateTime } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Reached only from the QR Ph flow once usePaymongoSource observes status === 'paid'
// (payment/qrph/[requestId].tsx's redirect). COD never lands here — it has its own
// confirmation screen (payment/cod/[requestId].tsx) since there's nothing to "receive"
// until pickup.
export default function PaymentSuccessScreen() {
  const { requestId, refNumber, amount, method } = useLocalSearchParams<{
    requestId: string;
    refNumber: string;
    amount: string;
    method: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const [downloadNotice, setDownloadNotice] = useState(false);

  const amountCentavos = Number(amount ?? 0);
  const paidAt = new Date().toISOString();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.checkOuter, { backgroundColor: `${theme.primary}26` }]}>
          <View style={[styles.checkInner, { backgroundColor: theme.primary }]}>
            <Ionicons name="checkmark" size={36} color={theme.onPrimary} />
          </View>
        </View>

        <ThemedText type="title" style={styles.title}>
          Payment Successful
        </ThemedText>
        <ThemedText type="title" style={[styles.amount, { color: theme.primary }]}>
          {formatCentavosAsPHP(amountCentavos)}
        </ThemedText>

        <Card style={styles.detailsCard}>
          <ThemedText type="smallBold" style={styles.detailsHeader}>
            Transaction Details
          </ThemedText>
          <Divider />
          <DetailRow label="Ref Number" value={refNumber ?? '—'} />
          <Divider />
          <DetailRow label="Date/Time" value={formatDateTime(paidAt)} />
          <Divider />
          <DetailRow label="Method" value={method ?? 'QR Ph'} />
        </Card>

        {downloadNotice ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
            Receipt download is coming soon.
          </ThemedText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <PrimaryButton
          label="Track My Request →"
          onPress={() => router.replace(`/services/requests/${requestId}`)}
        />
        <PrimaryButton
          label="Download Receipt ↓"
          variant="secondary"
          onPress={() => setDownloadNotice(true)}
        />
        <ThemedText
          type="link"
          style={styles.returnLink}
          onPress={() => router.replace('/')}>
          Return to Home
        </ThemedText>
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
  content: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },
  checkOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.four,
  },
  checkInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
  },
  amount: {
    fontSize: 24,
  },
  detailsCard: {
    width: '100%',
    marginTop: Spacing.three,
  },
  detailsHeader: {
    padding: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  centerText: {
    textAlign: 'center',
  },
  footer: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  returnLink: {
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
