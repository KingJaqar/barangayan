import { Ionicons } from '@expo/vector-icons';
import { estimateLabel, formatCentavosAsPHP, formatDateTime, progressFraction, type Tables } from '@barangayan/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
import { ActionSuccessModal } from '@/components/services/action-success-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { Fonts, Spacing } from '@/constants/theme';
import { useCountdown } from '@/hooks/use-countdown';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/** "Continue Payment 12:34" — mm:ss is enough for a button label; the QR Ph window is a
 * fixed 30 minutes, so it never needs the hours digit CountdownTimer's own pill shows. */
function formatButtonCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours' | 'fee_centavos'> | null;
  barangays: Pick<Tables<'barangays'>, 'shipping_fee_centavos'> | null;
};

interface StatusHistoryEntry {
  status: string;
  at: string;
  note: string | null;
}

const STEP_ORDER = ['submitted', 'in_progress', 'out_for_delivery', 'completed'];
const STEP_LABEL: Record<string, string> = {
  submitted: 'Request Submitted',
  in_progress: 'Processing',
  out_for_delivery: 'Out for Delivery',
  completed: 'Completed/Delivered',
};
const STEP_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  submitted: 'checkmark',
  in_progress: 'sync-outline',
  out_for_delivery: 'car-outline',
  completed: 'checkmark-circle-outline',
};

// Amber/orange, distinct from theme.primary/status colors — matches the reference
// design's in-progress percentage color, deliberately not tied to the user's
// Settings > App Theme accent (same reasoning as status-badge.tsx's STATUS_GREEN).
const PROGRESS_AMBER = '#F59E0B';

export default function RequestTrackingScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);
  // The most recent pending QR Ph payment attempt on this request, if any — drives the
  // "Cancel Payment" button and the "Continue Payment <timer>" label below. Undefined =
  // not checked yet, null = none pending.
  const [pendingPayment, setPendingPayment] = useState<{ id: string; expiresAt: number } | null | undefined>(
    undefined,
  );
  const [cancellingPayment, setCancellingPayment] = useState(false);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  // Drives the centered ActionSuccessModal — null means hidden. Set once a cancel
  // actually succeeds, instead of an Alert.alert(), so the confirmation reads as part
  // of the app rather than an OS-level dialog.
  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);
  // Ticks once a second while there's a pending payment to count down — drives the "Pay
  // Now with QR Ph" button's swap to "Continue Payment <mm:ss>" below.
  const pendingRemaining = useCountdown(pendingPayment?.expiresAt ?? null);
  // Unique per screen instance — same reason use-my-incidents.ts does this.
  // supabase.channel() returns the EXISTING channel when one with the same topic is
  // already registered, and .on() throws "cannot add postgres_changes callbacks after
  // subscribe()" on an already-subscribed channel. Two instances of this screen for the
  // same requestId are routinely alive at once — the payment success screen's "Track My
  // Requests" pushes a second one while the original is still in the navigation stack —
  // so a requestId-only topic collides. removeChannel() is also async, so a plain
  // remount can race the teardown the same way.
  const [instanceId] = useState(() => Math.random().toString(36).slice(2));

  useEffect(() => {
    let cancelled = false;

    function load() {
      supabase
        .from('service_requests')
        .select('*, document_types(name, processing_target_hours, fee_centavos), barangays(shipping_fee_centavos)')
        .eq('id', requestId)
        .single()
        .then(({ data }) => {
          if (!cancelled) setRequest(data as ServiceRequest | null);
        });
    }

    function loadPendingPayment() {
      supabase
        .from('payments')
        .select('id, expires_at')
        .eq('service_request_id', requestId)
        .eq('method', 'qrph')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
        .then(({ data }) => {
          if (cancelled) return;
          setPendingPayment(
            data
              ? { id: data.id, expiresAt: data.expires_at ? new Date(data.expires_at).getTime() : Date.now() }
              : null,
          );
        });
    }

    load();
    loadPendingPayment();

    // Realtime: this screen reflects status changes live, without a manual refresh.
    const channel = supabase
      .channel(`service-request-${requestId}-${instanceId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}` },
        load,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'payments', filter: `service_request_id=eq.${requestId}` },
        loadPendingPayment,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [requestId, instanceId]);

  function handleCancelPendingPayment() {
    if (!pendingPayment) return;
    Alert.alert(
      'Cancel Payment?',
      'This will void the current QR code. You can start a new payment at any time.',
      [
        { text: 'No, Keep It', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setCancellingPayment(true);
            try {
              const { data, error } = await supabase.functions.invoke('cancel-payment', {
                body: { paymentId: pendingPayment.id },
              });

              if (error) {
                // Parse the Edge Function's error message the same way the payment
                // screen's hook does — supabase-js wraps non-2xx responses in a
                // FunctionsHttpError whose context is the raw Response.
                let message = 'Please try again.';
                const context = (error as { context?: Response }).context;
                if (context && typeof context.json === 'function') {
                  try {
                    const body = await context.json();
                    const parsed = (body as { error?: unknown })?.error;
                    if (typeof parsed === 'string') message = parsed;
                  } catch {
                    // Body wasn't JSON — keep generic message.
                  }
                }
                Alert.alert('Could Not Cancel', message);
                return;
              }

              if (data?.status === 'cancelled' || data?.status === 'expired') {
                setPendingPayment(null);
                setSuccessModal({
                  title: 'Payment Cancelled',
                  message: 'Your QR Ph payment attempt has been cancelled. You can start a new payment at any time.',
                });
              } else if (data?.status === 'paid') {
                // Lost the race — payment went through while they were deciding.
                Alert.alert('Payment Completed', 'This payment was already completed.');
              } else {
                Alert.alert('Could Not Cancel', 'Please try again.');
              }
            } catch {
              Alert.alert('Could Not Cancel', 'Please try again.');
            } finally {
              setCancellingPayment(false);
            }
          },
        },
      ],
    );
  }

  function handleCancelRequest() {
    Alert.alert('Cancel Request?', 'This cannot be undone.', [
      { text: 'No, Keep It', style: 'cancel' },
      {
        text: 'Yes, Cancel',
        style: 'destructive',
        onPress: async () => {
          setCancellingRequest(true);
          try {
            const { error } = await supabase.rpc('cancel_own_service_request', {
              p_request_id: requestId,
              p_note: null,
            });

            if (error) {
              // Unlike cancel-payment above, this is a supabase.rpc() call — Postgres
              // exceptions surface as a plain error.message, not the Edge Function's
              // context.json() shape.
              Alert.alert('Could Not Cancel', error.message);
              return;
            }
            // No local state patch needed — the realtime subscription on service_requests
            // UPDATE (above) already calls load() and will pick up status: 'cancelled'.
            setSuccessModal({
              title: 'Request Cancelled',
              message: 'Your service request has been cancelled.',
            });
          } catch {
            Alert.alert('Could Not Cancel', 'Please try again.');
          } finally {
            setCancellingRequest(false);
          }
        },
      },
    ]);
  }

  if (request === undefined) {
    return <PlaceholderPanel label="Loading…" />;
  }
  if (request === null) {
    return <PlaceholderPanel label="Request not found." />;
  }

  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];
  const currentStepIndex = STEP_ORDER.indexOf(request.status);
  const targetHours = request.document_types?.processing_target_hours ?? 24;
  const isCancelled = request.status === 'cancelled';
  const fraction = isCancelled ? 0 : progressFraction(request.status, request.created_at, targetHours);
  const progressColor = request.status === 'completed' ? theme.primary : PROGRESS_AMBER;

  const fee = request.document_types?.fee_centavos ?? 0;
  const shippingFee = request.barangays?.shipping_fee_centavos ?? 0;
  const totalDue = fee + shippingFee;
  // payment_method is null until the resident reaches the payment selection screen
  // (Stage 4). Show a "Not yet selected" fallback for requests still in that gap.
  const paymentMethodLabel =
    request.payment_method === 'cash'
      ? 'Cash on Delivery'
      : request.payment_method === 'qrph'
        ? 'QR Ph'
        : 'Not yet selected';
  const paymentMethodIcon: keyof typeof Ionicons.glyphMap =
    request.payment_method === 'cash'
      ? 'cash-outline'
      : request.payment_method === 'qrph'
        ? 'qr-code-outline'
        : 'help-circle-outline';
  const isPaid = request.payment_status === 'paid';
  const isRefunded = request.payment_status === 'refunded';
  const paymentStatusLabel = isRefunded ? 'Refunded' : isPaid ? 'Paid' : 'Pending';
  const paymentStatusColor = isRefunded ? theme.accentRed : isPaid ? theme.primary : theme.textSecondary;
  // Payment no longer needs admin review first (see create-payment-source's comment) —
  // only block once the request is in a terminal state.
  const canPayNow = request.status !== 'cancelled' && request.status !== 'completed';
  const showQrPayNow =
    request.payment_method === 'qrph' && !isPaid && !isRefunded && canPayNow && totalDue >= 100 && PAYMENT_SETTLEMENT_READY;
  // A pending QR row whose expires_at has already passed is functionally gone —
  // create-payment-source will self-heal it into a fresh QR on next open (see its resume
  // check) — so the button should read "Pay Now" again rather than "Continue Payment
  // 0:00" forever.
  const hasActivePendingPayment = !!pendingPayment && (pendingRemaining ?? 0) > 0;
  // Either condition alone is sufficient to hide the cancel slot: once delivery has
  // started/finished/been cancelled, or once payment has actually cleared, there's
  // nothing left to self-cancel (a paid request needs the admin refund flow instead).
  const showCancelSlot =
    request.status !== 'out_for_delivery' &&
    request.status !== 'completed' &&
    request.status !== 'cancelled' &&
    request.payment_status !== 'paid';

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.primary }]}>
      <View style={[styles.root, { backgroundColor: '#F6F6F6' }]}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
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
              Request Tracking
            </ThemedText>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}
          showsVerticalScrollIndicator={false}>
          <ThemedText themeColor="textSecondary">Ref #{request.reference_number}</ThemedText>

          {!isCancelled ? (
            <Card style={styles.progressCard}>
            <View style={styles.progressHeaderRow}>
              <View style={styles.progressHeaderText}>
                <ThemedText type="smallBold">Processing Time</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {request.status === 'completed'
                    ? 'Completed and delivered'
                    : `Estimated completion — ${estimateLabel(request.created_at, targetHours)}`}
                </ThemedText>
              </View>
              <ThemedText type="smallBold" style={{ color: progressColor }}>
                {Math.round(fraction * 100)}%
              </ThemedText>
            </View>
            <ProgressBar fraction={fraction} color={progressColor} />
          </Card>
        ) : null}

        <Card style={styles.paymentCard}>
          <View style={styles.cardHeader}>
            <Ionicons name="wallet-outline" size={18} color={theme.primary} />
            <ThemedText type="smallBold">Payment</ThemedText>
          </View>
          <Divider />
          <View style={styles.paymentRow}>
            <View style={styles.paymentMethodCell}>
              <Ionicons name={paymentMethodIcon} size={16} color={theme.textSecondary} />
              <ThemedText type="small">{paymentMethodLabel}</ThemedText>
            </View>
            <View style={[styles.paymentStatusPill, { backgroundColor: `${paymentStatusColor}26` }]}>
              <ThemedText type="small" style={{ color: paymentStatusColor }}>
                {paymentStatusLabel}
              </ThemedText>
            </View>
          </View>
          {shippingFee > 0 ? (
            <>
              <View style={styles.paymentAmountRow}>
                <ThemedText type="small" themeColor="textSecondary">Document Fee</ThemedText>
                <ThemedText type="small">{fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}</ThemedText>
              </View>
              <View style={styles.paymentAmountRow}>
                <ThemedText type="small" themeColor="textSecondary">Shipping Fee</ThemedText>
                <ThemedText type="small">{formatCentavosAsPHP(shippingFee)}</ThemedText>
              </View>
            </>
          ) : null}
          <View style={styles.paymentAmountRow}>
            <ThemedText type="small" themeColor="textSecondary">Total Amount Due</ThemedText>
            <ThemedText type="smallBold">
              {totalDue === 0 ? 'Free' : formatCentavosAsPHP(totalDue)}
            </ThemedText>
          </View>
          {showQrPayNow || showCancelSlot ? (
            <View style={{ margin: Spacing.three, marginTop: Spacing.two, gap: Spacing.two }}>
              {showQrPayNow ? (
                <PrimaryButton
                  // Same QR/countdown is resumed, not regenerated — see
                  // create-payment-source's resume check — so this reads as "continue"
                  // rather than "pay now" once a payment attempt is already in flight.
                  label={
                    hasActivePendingPayment
                      ? `Continue Payment ${formatButtonCountdown(pendingRemaining ?? 0)}`
                      : 'Pay Now with QR Ph'
                  }
                  onPress={() => router.push(`/services/payment/qrph/${requestId}`)}
                />
              ) : null}
              {/* A single slot that swaps, not two buttons shown together: a pending QR
                  payment attempt takes priority (cancelling it is reversible — the
                  resident can start a fresh payment) over cancelling the whole request. */}
              {showCancelSlot ? (
                pendingPayment ? (
                  <PrimaryButton
                    label="Cancel Payment"
                    variant="destructive"
                    loading={cancellingPayment}
                    onPress={handleCancelPendingPayment}
                  />
                ) : (
                  <PrimaryButton
                    label="Cancel Request"
                    variant="destructive"
                    loading={cancellingRequest}
                    onPress={handleCancelRequest}
                  />
                )
              ) : null}
            </View>
          ) : null}
        </Card>

        <ThemedView type="backgroundElement" style={styles.timeline}>
          <ThemedText type="smallBold">Status History</ThemedText>

          {STEP_ORDER.map((step, index) => {
            const entry = history.find((h) => h.status === step);
            const isDone = index <= currentStepIndex && !isCancelled;
            const isCurrent = step === request.status;
            const isLast = index === STEP_ORDER.length - 1;

            return (
              <View key={step} style={styles.step}>
                <View style={styles.stepIndicator}>
                  <View
                    style={[
                      styles.stepDot,
                      { backgroundColor: isDone ? theme.primary : theme.backgroundSelected },
                      !isDone && { borderWidth: 1, borderColor: theme.textSecondary },
                    ]}>
                    {isDone ? (
                      <Ionicons name={STEP_ICON[step]} size={14} color={theme.onPrimary} />
                    ) : null}
                  </View>
                  {!isLast ? (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: index < currentStepIndex && !isCancelled ? theme.primary : theme.backgroundSelected },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={styles.stepBody}>
                  <ThemedText
                    type={isCurrent ? 'smallBold' : 'small'}
                    themeColor={isDone ? undefined : 'textSecondary'}
                    style={isCurrent ? { color: theme.primary } : undefined}>
                    {STEP_LABEL[step]}
                  </ThemedText>
                  {entry ? (
                    <>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatDateTime(entry.at)}
                      </ThemedText>
                      {entry.note ? (
                        <View style={[styles.noteChip, { backgroundColor: theme.backgroundSelected }]}>
                          <ThemedText type="small" themeColor="textSecondary">
                            {entry.note}
                          </ThemedText>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      Pending
                    </ThemedText>
                  )}
                </View>
              </View>
            );
          })}

          {isCancelled ? (
            <ThemedText type="small" themeColor="accentRed" style={styles.cancelledNote}>
              This request was cancelled.
              {(() => {
                const cancelEntry = history.find((h) => h.status === 'cancelled');
                return cancelEntry?.note ? ` ${cancelEntry.note}` : '';
              })()}
            </ThemedText>
          ) : null}
        </ThemedView>

        {request.requester_notes ? (
          <ThemedView type="backgroundElement" style={styles.section}>
            <ThemedText type="smallBold">Purpose</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {request.requester_notes}
            </ThemedText>
          </ThemedView>
        ) : null}
      </ScrollView>
      </View>

      <ActionSuccessModal
        visible={successModal !== null}
        title={successModal?.title ?? ''}
        message={successModal?.message ?? ''}
        onConfirm={() => setSuccessModal(null)}
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
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontSize: 20, fontFamily: Fonts.gideonRoman },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  progressCard: {
    padding: Spacing.three,
    gap: Spacing.two,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  progressHeaderText: {
    flex: 1,
    gap: Spacing.half,
  },
  timeline: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepIndicator: {
    alignItems: 'center',
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: Spacing.four,
  },
  stepBody: {
    flex: 1,
    gap: Spacing.half,
    paddingBottom: Spacing.two,
  },
  noteChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.four,
    marginTop: 2,
  },
  cancelledNote: {
    marginTop: Spacing.one,
  },
  section: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.one,
  },
  paymentCard: {
    gap: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  paymentMethodCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  paymentStatusPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.four,
  },
  paymentAmountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
});
