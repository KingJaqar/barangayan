import { Ionicons } from '@expo/vector-icons';
import { formatCentavosAsPHP, formatDateTime } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing, Fonts } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Reached only from the QR PH flow once usePaymongoSource observes status === 'paid'
// (payment/qrph/[requestId].tsx's redirect). Pay at Pickup never lands here — it has its
// own confirmation screen (payment/pickup/[requestId].tsx) since there's nothing to
// "receive" until pickup.
export default function PaymentSuccessScreen() {
  const { requestId, refNumber, amount, documentFee, method, sourceId } = useLocalSearchParams<{
    requestId: string;
    refNumber: string;
    amount: string;
    documentFee?: string;
    method: string;
    sourceId?: string;
  }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [isDownloading, setIsDownloading] = useState(false);

  const amountCentavos = Number(amount ?? 0);
  const paidAt = new Date().toISOString();

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
        documentFeeLabel: documentFee ? formatCentavosAsPHP(Number(documentFee)) : undefined,
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

  // One-shot celebratory pop on mount — purely additive, not tied to any conditional
  // prop, so it carries zero behavior risk.
  const checkScale = useSharedValue(0.7);
  useEffect(() => {
    checkScale.value = withSpring(1, { damping: 12, stiffness: 160 });
  }, [checkScale]);
  const checkAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
  }));

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={Spacing.two}>
            <Ionicons name="chevron-back" size={26} color="#fff" />
          </Pressable>
          <View style={styles.headerContent}>
            <ThemedText style={[styles.headerTitle, { color: theme.onPrimary }]}>
              Payment Successful
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.checkWrap}>
          <View style={[styles.checkGlow, { backgroundColor: `${theme.primary}14` }]} />
          <Animated.View style={[styles.checkOuter, { backgroundColor: `${theme.primary}26` }, checkAnimatedStyle]}>
            <View style={[styles.checkInner, { backgroundColor: theme.primary }]}>
              <Ionicons name="checkmark" size={36} color={theme.onPrimary} />
            </View>
          </Animated.View>
        </View>

        <ThemedText type="title" style={styles.title}>
          Payment Successful
        </ThemedText>
        <ThemedText type="title" style={[styles.amount, { color: theme.primary }]}>
          {formatCentavosAsPHP(amountCentavos)}
        </ThemedText>

        <View style={[styles.cardShadowWrap, styles.detailsCard]}>
          <Card>
            <ThemedText type="small" style={[styles.sectionLabel, styles.detailsHeader]} themeColor="textSecondary">
              Transaction Details
            </ThemedText>
            <Divider />
            <DetailRow label="Ref Number" value={refNumber ?? '—'} />
            <Divider />
            <DetailRow label="Date/Time" value={formatDateTime(paidAt)} />
            <Divider />
            <DetailRow label="Method" value={method ?? 'QR PH'} />
            {documentFee ? (
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
        <PrimaryButton
          label="Track My Request →"
          onPress={() => router.replace(`/services/requests/${requestId}`)}
        />
        <PrimaryButton
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
  header: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 25,
    justifyContent: 'center',
  },
  backBtn: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.two,
    width: 44, height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.gideonRoman },
  content: {
    padding: Spacing.four,
    alignItems: 'center',
    gap: Spacing.two,
  },

  /* Design-system recipes (shared literally across the Services screens) */
  cardShadowWrap: {
    // Card has overflow:'hidden' internally, which would clip a shadow applied directly
    // to it — this wrapper carries the shadow instead, without touching Card itself.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    borderRadius: Spacing.three,
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
    fontSize: 24,
  },
  amount: {
    fontSize: 24,
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
    padding: Spacing.three,
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
