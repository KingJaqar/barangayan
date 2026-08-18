import { formatCentavosAsPHP, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { AnimatedAppear } from '@/components/services/animated-appear';
import { CountdownTimer } from '@/components/services/countdown-timer';
import { PaymentSuccessModal } from '@/components/services/payment-success-modal';
import { QrGeneratingIndicator } from '@/components/services/qr-generating-indicator';
import { SkeletonBlock } from '@/components/services/skeleton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { usePaymongoSource } from '@/hooks/use-paymongo-source';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const BARANGAYAN_LOGO = require('@/assets/logo/barangayan-logo-1024.png');

// expo-media-library's native module isn't built into Expo Go — merely *importing* it
// there throws synchronously while the module evaluates (before any try/catch around the
// call site gets a chance to run), the same trap expo-notifications has in
// lib/push-notifications.ts. So check this first and never import the module at all
// inside Expo Go, rather than trying to catch our way out of it.
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'fee_centavos'> | null;
};

/** PayMongo returns next_action.code.image_url as a base64 PNG. Depending on the
 * account it arrives either already prefixed as a data URI or as bare base64 — expo-image
 * only renders the former, so normalise before handing it over. A real http(s) URL is
 * passed through untouched. */
function toRenderableImageUri(imageUrl: string): string {
  if (imageUrl.startsWith('data:') || imageUrl.startsWith('http')) return imageUrl;
  return `data:image/png;base64,${imageUrl}`;
}

const PAYMENT_STEPS = [
  'Open your GCash, Maya, or bank’s app',
  'Tap "Scan QR" or "Pay via QR PH"',
  'Scan the code above',
  'Confirm the amount and complete payment',
  'Return here — we’ll detect it automatically',
];

/** Shimmer stand-in for the loading state, shaped like the summary/QR/instructions cards
 * below it. Rendered only while `request === undefined` — same early-return slot
 * `PlaceholderPanel` used to occupy. */
function QrphSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      <SkeletonBlock width="100%" height={140} borderRadius={Spacing.three} />
      <SkeletonBlock width="100%" height={340} borderRadius={Spacing.three} style={styles.skeletonGap} />
      <SkeletonBlock width="100%" height={160} borderRadius={Spacing.three} style={styles.skeletonGap} />
    </View>
  );
}

// State 2b of the payment flow. Only reachable once PAYMENT_SETTLEMENT_READY is true —
// see constants/payment.ts and the plan's Part G for the settlement-account gating this
// screen assumes is already satisfied by the time a resident lands here.
//
// Payment no longer depends on admin having moved the request to "Processing" — see
// create-payment-source's comment (migration 0064 / "instant payment" plan). Any
// non-terminal request can be paid the moment the resident lands on this screen.
export default function QrPhPaymentScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  // Keep a ref to the Animated.Value; access .current outside render (in useEffect).
  const pulseRef = useRef(new Animated.Value(1));
  const qrFrameRef = useRef<View>(null);

  useEffect(() => {
    supabase
      .from('service_requests')
      .select('*, document_types(name, fee_centavos)')
      .eq('id', requestId)
      .single()
      .then(({ data }) => setRequest(data as ServiceRequest | null));
  }, [requestId]);

  // Fallback breakdown shown before the QR source has loaded — the source response
  // (once available) is the authoritative total actually being charged.
  const documentFee = request?.document_types?.fee_centavos ?? 0;
  const { source, status, errorMessage, cancelPayment, cancelling } = usePaymongoSource(requestId);
  const totalDue = source?.amountCentavos ?? documentFee;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRef.current, { toValue: 0.3, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseRef.current, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    ).start();
  }, [pulseRef]);

  // Shows the success modal instead of auto-navigating — the resident gets a clear,
  // deliberate "OK" confirmation step (they may have just switched back from their
  // bank/e-wallet app) rather than being yanked to a new screen mid-thought.
  useEffect(() => {
    if (status === 'paid') setShowSuccessModal(true);
  }, [status]);

  function handleConfirmSuccess() {
    if (!request) return;
    setShowSuccessModal(false);
    router.replace({
      pathname: '/services/payment/success',
      params: {
        requestId,
        refNumber: request.reference_number,
        amount: String(totalDue),
        documentFee: String(source?.documentFeeCentavos ?? documentFee),
        method: 'QR PH',
        sourceId: source?.paymentIntentId ?? '',
      },
    });
  }

  function handleCancelPayment() {
    Alert.alert(
      'Cancel Payment?',
      'This will void the current QR code. You can start a new payment at any time.',
      [
        { text: 'No, Keep Paying', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            const result = await cancelPayment();
            if (result.ok) router.back();
            else Alert.alert('Could Not Cancel', result.error ?? 'Please try again.');
          },
        },
      ],
    );
  }

  // Saves the QR code as an image, named after this payment's own reference number, as
  // an alternative to screenshotting — same pattern as qr-show-modal.tsx's download flow.
  async function handleSaveQr() {
    if (!qrFrameRef.current || savingQr || !request) return;
    if (Platform.OS === 'web') {
      Alert.alert('Not Supported', 'Saving QR codes is not supported on web.');
      return;
    }
    // Checked before any import — see isExpoGo's comment above for why this can't be a
    // try/catch around the import instead.
    if (isExpoGo) {
      Alert.alert(
        'Development Build Required',
        'Saving QR codes to your photo gallery requires a development build. Use a screenshot instead in Expo Go.',
      );
      return;
    }
    setSavingQr(true);
    try {
      const [expoMediaLibrary, expoFileSystem] = await Promise.all([
        import('expo-media-library'),
        import('expo-file-system'),
      ]);
      const { Asset, Album, requestPermissionsAsync } = expoMediaLibrary;
      const { File, Paths } = expoFileSystem;
      const { status: permStatus } = await requestPermissionsAsync();
      if (permStatus !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library access to save the QR code.');
        return;
      }

      const capturedUri = await captureRef(qrFrameRef, { format: 'png', quality: 1 });

      // Rename to the reference number before saving, so the gallery entry reads as
      // e.g. "REQ-2026-00035-QR.png" instead of a generic temp filename.
      const fileName = `${request.reference_number}-QR.png`;
      const destFile = new File(Paths.cache, fileName);
      await new File(capturedUri).copy(destFile, { overwrite: true });

      const asset = await Asset.create(destFile.uri);
      await Album.create('Barangayan QR Codes', [asset]);

      Alert.alert('Saved', `QR code saved to your photo gallery as "${fileName}".`);
    } catch {
      Alert.alert('Error', 'Failed to save the QR code. Please try again.');
    } finally {
      setSavingQr(false);
    }
  }

  if (request === undefined) {
    return <QrphSkeleton />;
  }
  if (request === null) {
    return <PlaceholderPanel label="Request not found." />;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: '#F6F6F6' }]}>
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
              Payment
            </ThemedText>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={[styles.summaryCard, styles.shadowSm, styles.hairline]}>
            <ThemedText type="small">Payment for</ThemedText>
            <ThemedText type="smallBold">{request.document_types?.name ?? 'Document Request'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Ref #{request.reference_number}
            </ThemedText>

            <View style={styles.breakdown}>
              <View style={styles.breakdownRow}>
                <ThemedText type="small" themeColor="textSecondary">Document Fee</ThemedText>
                <ThemedText type="small">{formatCentavosAsPHP(source?.documentFeeCentavos ?? documentFee)}</ThemedText>
              </View>
            </View>

            <ThemedText type="title" style={[styles.amount, { color: theme.primary }]}>
              {totalDue === 0 ? 'Free' : formatCentavosAsPHP(totalDue)}
            </ThemedText>
            {source ? (
              <>
                <CountdownTimer expiresAt={source.expiresAt} />
                <ThemedText type="small" themeColor="textSecondary">
                  Transaction ref: {source.paymentIntentId}
                </ThemedText>
              </>
            ) : null}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.qrCard, styles.shadowMd, styles.hairline]}>
            <AnimatedAppear key={status} style={styles.qrCardBranch}>
              {status === 'loading' || (!source && status !== 'error') ? (
                <QrGeneratingIndicator />
              ) : status === 'error' ? (
                <>
                  <ThemedText type="small" themeColor="accentRed" style={styles.qrCaption}>
                    {errorMessage === 'Request is not ready for payment'
                      ? 'This request can no longer be paid (it may have been cancelled or completed).'
                      : (errorMessage ?? 'Could not start a QR PH payment. Please try again.')}
                  </ThemedText>
                  <Pressable onPress={() => router.back()} hitSlop={Spacing.two}>
                    <ThemedText type="link">Go Back</ThemedText>
                  </Pressable>
                </>
              ) : status === 'expired' ? (
                <ThemedText type="small" themeColor="accentRed">
                  This QR code has expired. Go back and try again.
                </ThemedText>
              ) : status === 'cancelled' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Payment cancelled. Go back and try again if you'd like to pay.
                </ThemedText>
              ) : source ? (
                <>
                  <View ref={qrFrameRef} collapsable={false} style={styles.qrFrame}>
                    <Image
                      source={{ uri: toRenderableImageUri(source.qrImageUrl) }}
                      style={styles.qrImage}
                      contentFit="contain"
                    />
                  </View>
                  <Pressable onPress={handleSaveQr} disabled={savingQr} style={styles.saveQrRow} hitSlop={Spacing.two}>
                    <Ionicons name={savingQr ? 'reload' : 'download-outline'} size={16} color={theme.primary} />
                    <ThemedText type="small" style={{ color: theme.primary }}>
                      {savingQr ? 'Saving…' : `Save QR (Ref #${request.reference_number})`}
                    </ThemedText>
                  </Pressable>
                </>
              ) : null}
            </AnimatedAppear>
          </ThemedView>

          {status === 'pending' || status === 'paid' ? (
            <AnimatedAppear>
              <ThemedView type="backgroundElement" style={[styles.instructionsCard, styles.shadowSm, styles.hairline]}>
                <ThemedText type="small" style={styles.sectionLabel} themeColor="textSecondary">
                  How to Pay
                </ThemedText>
                {PAYMENT_STEPS.map((step, index) => (
                  <View key={step} style={styles.instructionRow}>
                    <View style={[styles.stepBadge, { backgroundColor: theme.primary }]}>
                      <ThemedText type="small" style={{ color: theme.onPrimary }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={styles.instructionText}>
                      {step}
                    </ThemedText>
                  </View>
                ))}
              </ThemedView>
            </AnimatedAppear>
          ) : null}

          <View style={styles.brandRow}>
            <Image source={BARANGAYAN_LOGO} style={styles.brandLogo} contentFit="contain" />
            <ThemedText style={[styles.brandText, { color: theme.text, fontFamily: Fonts.gideonRoman }]}>
              barangayan
            </ThemedText>
          </View>

          {status === 'pending' ? (
            <AnimatedAppear>
              <View style={styles.waitingRow}>
                <Animated.View style={[styles.dot, { backgroundColor: theme.primary, opacity: pulseRef.current }]} />
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
            </AnimatedAppear>
          ) : null}

          {status === 'pending' ? (
            <AnimatedAppear>
              <PrimaryButton
                label="Cancel Payment"
                variant="destructive"
                loading={cancelling}
                onPress={handleCancelPayment}
              />
            </AnimatedAppear>
          ) : null}
        </ScrollView>
      </View>

      <PaymentSuccessModal
        visible={showSuccessModal}
        amountCentavos={totalDue}
        onConfirm={handleConfirmSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1, backgroundColor: '#F6F6F6' },
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
    gap: Spacing.three,
  },

  /* Design-system recipes (shared literally across the Services screens) */
  shadowSm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  shadowMd: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 5,
  },
  hairline: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    fontSize: 12,
  },

  summaryCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    alignItems: 'center',
    gap: Spacing.one,
  },
  breakdown: {
    width: '100%',
    marginTop: Spacing.two,
    gap: Spacing.half,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
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
    minHeight: 340,
    justifyContent: 'center',
  },
  qrCardBranch: {
    alignItems: 'center',
    gap: Spacing.two,
  },
  qrFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  qrImage: {
    width: 280,
    height: 280,
  },
  saveQrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  qrCaption: {
    textAlign: 'center',
  },
  instructionsCard: {
    padding: Spacing.four,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  stepBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  instructionText: {
    flex: 1,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  brandLogo: {
    width: 28,
    height: 28,
  },
  brandText: {
    fontSize: 20,
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

  /* Loading skeleton */
  skeletonContainer: {
    flex: 1,
    padding: Spacing.four,
    backgroundColor: '#F6F6F6',
  },
  skeletonGap: {
    marginTop: Spacing.three,
  },
});
