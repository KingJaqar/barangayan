import { requestFeeLabel, requestFee, formatCentavosAsPHP, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Image } from 'expo-image';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Animated, AppState, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { captureRef } from 'react-native-view-shot';

import { PrimaryButton } from '@/components/primary-button';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { useCountdown } from '@/hooks/use-countdown';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { CountdownTimer } from '@/components/services/countdown-timer';
import { PaymentSuccessModal } from '@/components/services/payment-success-modal';
import { QrGeneratingIndicator } from '@/components/services/qr-generating-indicator';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
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

/** Static placeholder for the loading state, shaped like the summary/QR/instructions cards
 * below it. Rendered only while `request === undefined` — same early-return slot
 * `PlaceholderPanel` used to occupy. */
function QrphSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.skeletonContainer, { backgroundColor: theme.resident.card }]}>
      <View style={[{ width: '100%', height: 180, borderRadius: 16, backgroundColor: theme.resident.surface }, styles.skeletonGap]} />
      <View style={[{ width: '100%', height: 308, borderRadius: 16, backgroundColor: theme.resident.surface }, styles.skeletonGap]} />
      <View style={[{ width: '100%', height: 160, borderRadius: 16, backgroundColor: theme.resident.surface }, styles.skeletonGap]} />
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
  const reducedMotion = useResidentReducedMotion(true);
  const [focused, setFocused] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [imageFailed, setImageFailed] = useState(false);
  useFocusEffect(useCallback(() => { setFocused(true); return () => setFocused(false); }, []));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  const [loadError, setLoadError] = useState(false);
  const [queryRetry, setQueryRetry] = useState(0);
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savingQr, setSavingQr] = useState(false);
  // Keep a ref to the Animated.Value; access .current outside render (in useEffect).
  const pulseRef = useRef(new Animated.Value(1));
  const qrFrameRef = useRef<View>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('service_requests')
      .select('*, document_types(name, fee_centavos)')
      .eq('id', requestId)
      .single()
      .then(({ data, error }) => { if (active) { setLoadError(Boolean(error)); setRequest(data as ServiceRequest | null); } }, () => { if (active) { setLoadError(true); setRequest(null); } });
    return () => { active = false; };
  }, [requestId, queryRetry]);

  // Fallback breakdown shown before the QR source has loaded — the source response
  // (once available) is the authoritative total actually being charged.
  const documentFee = request ? requestFee(request, request.document_types?.fee_centavos ?? 0) : null;
  const { source, status, errorMessage, cancelPayment, cancelling } = usePaymongoSource(requestId);
  const totalDue = source?.amountCentavos ?? documentFee;

  const remaining = useCountdown(source?.expiresAt ?? null);
  const expired = source !== null && (remaining ?? 0) <= 0;
  const decorationActive = focused && foreground && !reducedMotion;
  useEffect(() => { setImageFailed(false); }, [source?.qrImageUrl]);
  useEffect(() => {
    const pulse = pulseRef.current;
    pulse.setValue(1);
    if (!decorationActive || status !== 'pending' || expired) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 0.3, duration: 500, useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true, isInteraction: false }),
    ]));
    animation.start();
    return () => { animation.stop(); pulse.setValue(1); };
  }, [decorationActive, status, expired]);

  // Shows the success modal instead of auto-navigating — the resident gets a clear,
  // deliberate "OK" confirmation step (they may have just switched back from their
  // bank/e-wallet app) rather than being yanked to a new screen mid-thought.
  useEffect(() => {
    if (status === 'paid') setShowSuccessModal(true);
  }, [status]);

  useEffect(() => {
    if (status === 'already_paid') {
      router.replace(`/services/requests/${requestId}`);
    }
  }, [status, requestId, router]);

  function handleConfirmSuccess() {
    if (!request) return;
    setShowSuccessModal(false);
    router.replace({
      pathname: '/services/payment/success',
      params: {
        requestId,
        refNumber: request.reference_number,
        amount: String(totalDue ?? 0),
        documentFee: String(source?.documentFeeCentavos ?? documentFee ?? 0),
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
    return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.card }}><ServiceScreenHeader title="Payment" /><QrphSkeleton /></SafeAreaView>;
  }
  if (request === null) {
    return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.card }}><ServiceScreenHeader title="Payment" />
      <View style={{ padding: 20, gap: 16 }}><ThemedText accessibilityRole={loadError ? 'alert' : undefined}>{loadError ? 'Could not load payment details. Reconnect and retry.' : 'Request not found.'}</ThemedText>
        <PrimaryButton presentation="resident" label="Retry payment details" onPress={() => setQueryRetry(value => value + 1)} />
      </View></SafeAreaView>;
  }

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.resident.accent }]}>
      <View style={[styles.root, { backgroundColor: theme.resident.card }]}>
        <ServiceScreenHeader title="Payment" />

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView type="backgroundElement" style={[styles.summaryCard, styles.hairline, { borderColor: theme.resident.border, backgroundColor: theme.resident.card }]}>
            <View style={styles.summaryHeading}>
            <ThemedText style={{ fontSize: 12.5, lineHeight: 18, color: theme.resident.muted }}>Payment for</ThemedText>
            <ThemedText style={{ fontSize: 16, lineHeight: 21, fontWeight: '700' }}>{request.document_types?.name ?? 'Document Request'}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Ref #{request.reference_number}
            </ThemedText>

            </View>
            <View style={[styles.feeSummary, { borderColor: theme.resident.border }]}>
              <View style={styles.breakdown}>
                <ThemedText type="small" themeColor="textSecondary">Document Fee</ThemedText>
                <ThemedText type="small">{source?.documentFeeCentavos != null ? formatCentavosAsPHP(source.documentFeeCentavos) : documentFee === null ? requestFeeLabel(request, null) : formatCentavosAsPHP(documentFee)}</ThemedText>
              </View>

              <ThemedText type="title" style={[styles.amount, { color: theme.resident.accentText }]}>
                {totalDue === 0 ? 'Free' : totalDue === null ? requestFeeLabel(request, null) : formatCentavosAsPHP(totalDue)}
              </ThemedText>
            </View>
            {source ? (
              <View style={[styles.expiryRow, { backgroundColor: theme.resident.surface, borderColor: theme.resident.border }]}>
                <CountdownTimer remaining={remaining ?? 0} />
                <ThemedText type="small" themeColor="textSecondary">
                  Transaction ref: {source.paymentIntentId}
                </ThemedText>
              </View>
            ) : null}
          </ThemedView>

          <ThemedView type="backgroundElement" style={[styles.qrCard, styles.hairline, { borderColor: theme.resident.border, backgroundColor: theme.resident.card }]}>
            <View key={status} style={styles.qrCardBranch}>
              {status === 'loading' || status === 'idle' ? (
                <QrGeneratingIndicator active={decorationActive} />
              ) : status === 'error' ? (
                <>
                  <ThemedText type="small" style={[styles.qrCaption, { color: theme.resident.danger }]}>
                    {errorMessage === 'Request is not ready for payment'
                      ? 'This request can no longer be paid (it may have been cancelled or completed).'
                      : (errorMessage ?? 'Could not start a QR PH payment. Please try again.')}
                  </ThemedText>
                  <Pressable onPress={() => router.back()} hitSlop={Spacing.two}>
                    <ThemedText type="link">Go Back</ThemedText>
                  </Pressable>
                </>
              ) : status === 'expired' || expired ? (
                <ThemedText type="small" style={{ color: theme.resident.danger }}>
                  This QR code has expired. Go back and reopen payment to continue.
                </ThemedText>
              ) : status === 'cancelled' ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Payment cancelled. Go back and try again if you'd like to pay.
                </ThemedText>
              ) : source ? (
                <>
                  <View ref={qrFrameRef} collapsable={false} style={[styles.qrFrame, { backgroundColor: '#FFFFFF' }]}>
                    {imageFailed ? <ThemedText accessibilityRole="alert" style={{ color: '#222222', textAlign: 'center' }}>Could not display the payment QR. Go back and reopen payment to retry.</ThemedText> : <Image
                      accessibilityLabel="Provider payment QR code"
                      onError={() => setImageFailed(true)}
                      source={{ uri: toRenderableImageUri(source.qrImageUrl) }}
                      style={styles.qrImage}
                      contentFit="contain"
                    />}
                  </View>
                  <Pressable onPress={handleSaveQr} disabled={savingQr || imageFailed} style={styles.saveQrRow} accessibilityRole="button">
                    <Ionicons name={savingQr ? 'reload' : 'download-outline'} size={16} color={theme.resident.accentText} />
                    <ThemedText type="small" style={[styles.saveQrText, { color: theme.resident.accentText }]}>
                      {savingQr ? 'Saving…' : `Save QR (Ref #${request.reference_number})`}
                    </ThemedText>
                  </Pressable>
                </>
              ) : null}
            </View>
            {status === 'expired' || status === 'cancelled' || expired ? <PrimaryButton presentation="resident" label="Back to payment" variant="secondary" onPress={() => router.back()} /> : null}
          </ThemedView>

          {(status === 'pending' && !expired) || status === 'paid' ? (
            <View>
              <ThemedView type="backgroundElement" style={[styles.instructionsCard, { backgroundColor: theme.resident.surface }]}>
                <ThemedText type="small" style={styles.sectionLabel} themeColor="textSecondary">
                  How to pay
                </ThemedText>
                {PAYMENT_STEPS.map((step, index) => (
                  <View key={step} style={styles.instructionRow}>
                    <View style={[styles.stepBadge, { backgroundColor: theme.resident.accent }]}>
                      <ThemedText type="small" style={{ color: theme.resident.onAccent }}>
                        {index + 1}
                      </ThemedText>
                    </View>
                    <ThemedText type="small" style={styles.instructionText}>
                      {step}
                    </ThemedText>
                  </View>
                ))}
              </ThemedView>
            </View>
          ) : null}

          <View style={styles.brandRow}>
            <Image source={BARANGAYAN_LOGO} style={styles.brandLogo} contentFit="contain" />
            <ThemedText style={styles.brandText}>
              barangayan
            </ThemedText>
          </View>

          {status === 'pending' && !expired ? (
            <View>
              <View style={[styles.waitingRow, { backgroundColor: theme.resident.accentSoft, borderColor: theme.resident.border }]}>
                <Animated.View style={[styles.dot, { backgroundColor: theme.resident.accent, opacity: pulseRef.current }]} />
                <View style={styles.waitingText}>
                  <ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>
                    Waiting for payment...
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    Do not close this screen while paying. It will automatically update once
                    payment is received.
                  </ThemedText>
                </View>
              </View>
            </View>
          ) : null}

          {status === 'pending' ? (
            <View>
              <PrimaryButton presentation="resident"
                label="Cancel Payment"
                variant="destructive"
                loading={cancelling}
                onPress={handleCancelPayment}
              />
            </View>
          ) : null}
        </ScrollView>
      </View>

      <PaymentSuccessModal
        visible={showSuccessModal}
        amountCentavos={source?.amountCentavos ?? 0}
        onConfirm={handleConfirmSuccess}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  root: { flex: 1 },
  content: {
    padding: 20,
    gap: 16,
  },

  hairline: {
    borderWidth: 1,
  },
  sectionLabel: {
    fontSize: 15, lineHeight: 21, fontWeight: '700',
  },

  summaryHeading: { padding: 16, gap: 4 },
  expiryRow: { padding: 12, borderTopWidth: 1, gap: 8 },
  summaryCard: { boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    overflow: 'hidden',
    borderRadius: 16,
    gap: Spacing.one,
  },
  feeSummary: {
    paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: Spacing.three,
    rowGap: Spacing.one,
    marginTop: Spacing.one,
  },
  breakdown: {
    flexShrink: 1,
    gap: Spacing.half,
  },
  amount: {
    fontSize: 32,
    fontWeight: '800',
    lineHeight: 36,
    flexShrink: 1,
  },
  qrCard: { boxShadow: '0 2px 10px rgba(0,0,0,0.05)',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  qrCardBranch: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.one,
  },
  qrFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 236,
    padding: 10,
    borderRadius: Spacing.two,
  },
  qrImage: {
    width: '100%',
    aspectRatio: 1,
  },
  saveQrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    maxWidth: '100%',
  },
  saveQrText: {
    flexShrink: 1,
  },
  qrCaption: {
    textAlign: 'center',
  },
  instructionsCard: {
    padding: 16,
    borderRadius: 16,
    gap: Spacing.one,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  stepBadge: {
    minWidth: 24,
    minHeight: 24,
    paddingHorizontal: Spacing.one,
    borderRadius: 11,
    flexShrink: 0,
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
    width: 22,
    height: 22,
  },
  brandText: {
    fontSize: 16,
  },
  waitingRow: {
    padding: 16, borderWidth: 1, borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  waitingText: {
    flex: 1,
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
    padding: 16,
  },
  skeletonGap: {
    marginTop: Spacing.two,
  },
});
