import { estimateLabel, formatCentavosAsPHP, formatDateTime, progressFraction, requestFee, requestFeeLabel, submittedDetailLines, type Tables } from '@barangayan/shared';
import { AgencySlaStatus } from '@/components/services/agency-sla-status';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DocumentIcon } from '@/components/document-icon';
import { getDocumentIcon } from '@/constants/document-icons';
import { Card } from '@/components/card';
import { PrimaryButton } from '@/components/primary-button';
import { ProgressBar } from '@/components/progress-bar';
import { ActionSuccessModal } from '@/components/services/action-success-modal';
import { TrackingReveal } from '@/components/services/tracking-reveal';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { Spacing } from '@/constants/theme';
import { useCountdown } from '@/hooks/use-countdown';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

/** "Continue Payment 12:34" — mm:ss is enough for a button label; the QR PH window is a
 * fixed 30 minutes, so it never needs the hours digit CountdownTimer's own pill shows. */
function formatButtonCountdown(ms: number): string {
  const totalSeconds = Math.max(Math.floor(ms / 1000), 0);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

type ServiceRequest = Tables<'service_requests'> & {
  payments?: {document_fee_centavos:number|null;amount_centavos:number;status:string}[];
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours' | 'fee_centavos'> | null;
};

interface StatusHistoryEntry {
  status: string;
  at: string;
  note: string | null;
}

const STEP_ORDER = ['submitted', 'in_progress', 'ready_for_pickup', 'completed'];
const STEP_LABEL: Record<string, string> = {
  submitted: 'Request Submitted',
  in_progress: 'Processing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
};
const STEP_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  submitted: 'checkmark',
  in_progress: 'sync-outline',
  ready_for_pickup: 'storefront-outline',
  completed: 'checkmark-circle-outline',
};

/** Static placeholder for the loading state, shaped like the progress/payment/timeline
 * cards below it. Rendered only while request data is loading, without a background animation. */
function RequestTrackingSkeleton() {
  const theme = useTheme();
  return (
    <View style={[styles.skeletonContainer, { backgroundColor: theme.resident.card }]}>
      <View style={[{ width: '40%', height: 16, borderRadius: 16, backgroundColor: theme.resident.surface }, styles.skeletonGap]} />
      <View style={[{ width: '100%', height: 72, borderRadius: 16, backgroundColor: theme.resident.surface }, styles.skeletonGap]} />
      <View style={[{ width: '100%', height: 110, borderRadius: 16, backgroundColor: theme.resident.surface }, styles.skeletonGap]} />
      <View style={[{ width: '100%', height: 220, borderRadius: 16, backgroundColor: theme.resident.surface }, styles.skeletonGap]} />
    </View>
  );
}

// Each entry tab owns its tracking route so Back pops that tab's stack.
export default function RequestTrackingScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const theme = useTheme();
  const [loadError, setLoadError] = useState<string | null>(null);
  const reducedMotion = useResidentReducedMotion(true);
  const [retry, setRetry] = useState(0);
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);
  // The most recent pending QR PH payment attempt on this request, if any — drives the
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
  // Now with QR PH" button's swap to "Continue Payment <mm:ss>" below.
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
        .select('*, document_types(name, processing_target_hours, fee_centavos), payments(document_fee_centavos, amount_centavos, status)')
        .eq('id', requestId)
        .single()
        .then(({ data, error }) => {
          if (cancelled) return;
          setLoadError(error ? 'Could not load this request. Reconnect and retry.' : null);
          setRequest(data as ServiceRequest | null);
        }, () => {
          if (!cancelled) { setLoadError('Could not load this request. Reconnect and retry.'); setRequest(null); }
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
  }, [requestId, instanceId, retry]);

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
                  message: 'Your QR PH payment attempt has been cancelled. You can start a new payment at any time.',
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
    return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.card }}><ServiceScreenHeader title="Request Tracking" /><RequestTrackingSkeleton /></SafeAreaView>;
  }
  if (request === null) {
    return <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.card }}>
      <ServiceScreenHeader title="Request Tracking" />
      <View style={{ padding: 20, gap: 16 }}><ThemedText accessibilityRole={loadError ? 'alert' : undefined}>{loadError ?? 'Request not found.'}</ThemedText>
        <PrimaryButton presentation="resident" label="Retry request" onPress={() => setRetry(value => value + 1)} />
      </View>
    </SafeAreaView>;
  }

  const history = (request.status_history as unknown as StatusHistoryEntry[]) ?? [];
  const currentStepIndex = STEP_ORDER.indexOf(request.status);
  const targetHours = request.document_types?.processing_target_hours ?? 24;
  const isCancelled = request.status === 'cancelled';
  const fraction = isCancelled ? 0 : progressFraction(request.status, request.created_at, targetHours);
  const progressColor = request.status === 'completed' ? theme.resident.accentText : theme.resident.warning;

  const recordedPayment = request.payments?.find(payment => payment.status === 'paid') ?? request.payments?.[0];
  const fee = requestFee(request, request.document_types?.fee_centavos ?? 0, recordedPayment?.document_fee_centavos ?? recordedPayment?.amount_centavos);
  const totalDue = fee;
  const isPaid = request.payment_status === 'paid';
  const isRefunded = request.payment_status === 'refunded';
  const isWaived = request.payment_status === 'waived';
  const noPaymentRequired = isWaived || totalDue === 0;
  // payment_method is null until the resident reaches the payment selection screen
  // (Stage 4). Show a "Not yet selected" fallback for requests still in that gap.
  const paymentMethodLabel =
    noPaymentRequired
      ? 'Not required'
      : request.payment_method === 'pickup'
        ? 'Pay at Pickup'
        : request.payment_method === 'qrph'
          ? 'QR PH'
          : 'Not yet selected';
  const paymentMethodIcon: keyof typeof Ionicons.glyphMap =
    noPaymentRequired
      ? 'checkmark-circle-outline'
      : request.payment_method === 'pickup'
        ? 'cash-outline'
        : request.payment_method === 'qrph'
          ? 'qr-code-outline'
          : 'help-circle-outline';
  const paymentStatusLabel = isCancelled ? 'Cancelled' : isWaived ? 'Fee waived' : isRefunded ? 'Refunded' : isPaid ? 'Paid' : noPaymentRequired ? 'No payment required' : 'Pending';
  const paymentStatusColor = isCancelled || isRefunded ? theme.resident.danger : isPaid ? theme.resident.accentText : theme.resident.muted;
  const canPayNow =
    request.status !== 'cancelled' && request.status !== 'completed' &&
    !isPaid && !isRefunded && !noPaymentRequired && totalDue !== null && totalDue > 0;
  const showChoosePaymentMethod = request.payment_method === null && canPayNow;
  const showPickupMessage = request.payment_method === 'pickup' && canPayNow;
  const showQrPayNow =
    request.payment_method === 'qrph' && canPayNow && totalDue !== null && totalDue >= 100 && PAYMENT_SETTLEMENT_READY;
  // A pending QR row whose expires_at has already passed is functionally gone —
  // create-payment-source will self-heal it into a fresh QR on next open (see its resume
  // check) — so the button should read "Pay Now" again rather than "Continue Payment
  // 0:00" forever.
  const hasActivePendingPayment = !!pendingPayment && (pendingRemaining ?? 0) > 0;
  // Either condition alone is sufficient to hide the cancel slot: once delivery has
  // started/finished/been cancelled, or once payment has actually cleared, there's
  // nothing left to self-cancel (a paid request needs the admin refund flow instead).
  const showCancelSlot =
    request.status !== 'ready_for_pickup' &&
    request.status !== 'completed' &&
    request.status !== 'cancelled' &&
    request.payment_status !== 'paid';

  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[styles.safeArea, { backgroundColor: theme.resident.accent }]}>
      <View style={[styles.root, { backgroundColor: theme.resident.surface }]}>
        <ServiceScreenHeader title="Request Tracking" />

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <TrackingReveal reducedMotion={reducedMotion} style={styles.sections}>
          <View style={styles.hero}>
            <View style={[styles.heroIcon, { backgroundColor: theme.resident.accentSoft }]}><DocumentIcon name={getDocumentIcon(request.document_types?.name ?? 'Document Request')} size={22} color={theme.resident.accentText} accessible={false} /></View>
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <ThemedText accessibilityRole="header" style={styles.heroTitle}>{request.document_types?.name ?? 'Document Request'}</ThemedText>
              <ThemedText selectable style={{ fontSize: 12, lineHeight: 18, color: theme.resident.muted }}>Ref #{request.reference_number}</ThemedText>
            </View>
          </View>

          {request.timing_model !== 'agency_minutes_v1' ? <ThemedText type="small">Previous timing model · original processing estimate retained</ThemedText> : null}
          {request.timing_model === 'agency_minutes_v1' ? <AgencySlaStatus requestId={request.id} /> : !isCancelled ? (
                <Card variant="resident" style={styles.progressCard}>
                  <View style={styles.progressHeaderRow}>
                    <View style={styles.progressHeaderText}>
                      <ThemedText type="smallBold">Processing Time</ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {request.status === 'completed'
                          ? 'Completed'
                          : `Estimated completion — ${estimateLabel(request.created_at, targetHours)}`}
                      </ThemedText>
                    </View>
                    <ThemedText type="smallBold" style={{ color: progressColor }}>
                      {Math.round(fraction * 100)}%
                    </ThemedText>
                  </View>
                  <ProgressBar fraction={fraction} color={progressColor} presentation="resident" />
                </Card>
          ) : null}

        <View>
          <Card variant="resident" style={styles.paymentCard}>
          <View style={[styles.cardHeader, { borderColor: theme.resident.border }]}>
            <Ionicons name="wallet-outline" size={18} color={theme.resident.accentText} />
            <ThemedText type="small" style={styles.sectionLabel}>
              Payment
            </ThemedText>
            <View style={[styles.paymentStatusPill, { backgroundColor: isCancelled || isRefunded ? theme.resident.dangerSoft : isPaid || noPaymentRequired ? theme.resident.accentSoft : theme.resident.surface }]}>
              <ThemedText style={[styles.pillText, { color: paymentStatusColor }]}>{paymentStatusLabel}</ThemedText>
            </View>
          </View>
          <View style={styles.paymentSummary}>
            <ThemedText style={[styles.amountLabel, { color: theme.resident.muted }]}>Total Amount Due</ThemedText>
            <ThemedText style={styles.paymentAmount}>
              {isWaived ? 'Fee waived' : totalDue === null ? requestFeeLabel(request, null) : totalDue === 0 ? 'No payment required' : formatCentavosAsPHP(totalDue)}
            </ThemedText>
          </View>
          <View style={styles.paymentRow}>
            <View style={styles.paymentMethodCell}>
              <Ionicons name={paymentMethodIcon} size={16} color={theme.textSecondary} />
              <ThemedText style={{ flexShrink: 1, fontWeight: '600', fontSize: 13, lineHeight: 19 }}>{paymentMethodLabel}</ThemedText>
            </View>
          </View>
          {showPickupMessage ? (
            <ThemedText style={[styles.pickupMessage, { color: theme.resident.muted }]}>
              Pay when collecting your document.
            </ThemedText>
          ) : null}
          {showChoosePaymentMethod || showQrPayNow || showCancelSlot ? (
            <View style={styles.buttonSlot}>
              {showChoosePaymentMethod ? (
                <PrimaryButton presentation="resident" compact
                  label="Choose payment method"
                  onPress={() => router.push(`/services/payment/${requestId}`)}
                />
              ) : null}
              {showQrPayNow ? (
                <View key={hasActivePendingPayment ? 'continue' : 'pay-now'}>
                  <PrimaryButton presentation="resident" compact
                    // Same QR/countdown is resumed, not regenerated — see
                    // create-payment-source's resume check — so this reads as "continue"
                    // rather than "pay now" once a payment attempt is already in flight.
                    label={
                      hasActivePendingPayment
                        ? `Continue Payment · ${formatButtonCountdown(pendingRemaining ?? 0)}`
                        : 'Pay Now with QR PH'
                    }
                    onPress={() => router.push(`/services/payment/qrph/${requestId}`)}
                  />
                </View>
              ) : null}
              {/* A single slot that swaps, not two buttons shown together: a pending QR
                  payment attempt takes priority (cancelling it is reversible — the
                  resident can start a fresh payment) over cancelling the whole request. */}
              {showCancelSlot ? (
                <View key={showQrPayNow && hasActivePendingPayment ? 'cancel-payment' : 'cancel-request'}>
                  {showQrPayNow && hasActivePendingPayment ? (
                    <PrimaryButton presentation="resident" compact
                      label="Cancel Payment"
                      variant="destructive"
                      loading={cancellingPayment}
                      onPress={handleCancelPendingPayment}
                    />
                  ) : (
                    <PrimaryButton presentation="resident" compact
                      label="Cancel Request"
                      variant="destructive"
                      loading={cancellingRequest}
                      onPress={handleCancelRequest}
                    />
                  )}
                </View>
              ) : null}
            </View>
          ) : null}
          </Card>
        </View>

        <ThemedView type="backgroundElement" style={[styles.timeline, { backgroundColor: theme.resident.card, borderColor: theme.resident.border, borderWidth: 1 }]}>
          <View style={styles.timelineHeading}>
            <ThemedText accessibilityRole="header" style={styles.sectionLabel}>Status history</ThemedText>
            {!isCancelled ? <ThemedText style={[styles.stageCount, { color: theme.resident.muted }]}>{Math.max(0, currentStepIndex + 1)} of {STEP_ORDER.length}</ThemedText> : null}
          </View>

          <View>
          {STEP_ORDER.map((step, index) => {
            const entry = history.find((h) => h.status === step);
            const isDone = Boolean(entry) || (index <= currentStepIndex && !isCancelled);
            const isCurrent = step === request.status;
            const isLast = index === STEP_ORDER.length - 1;

            return (
              <View key={step} style={styles.step}>
                <View style={styles.stepIndicator}>
                  <View
                    style={[
                      styles.stepDot,
                      { backgroundColor: isDone ? theme.resident.accent : theme.resident.surface },
                      !isDone && { borderWidth: 2, borderColor: theme.resident.border },
                    ]}>
                    {isDone ? (
                      <Ionicons name={STEP_ICON[step]} size={13} color={theme.resident.onAccent} accessible={false} />
                    ) : <ThemedText style={[styles.stepNumber, { color: theme.resident.muted }]}>{index + 1}</ThemedText>}
                  </View>
                  {!isLast ? (
                    <View
                      style={[
                        styles.stepLine,
                        { backgroundColor: index < currentStepIndex && !isCancelled ? theme.resident.accent : theme.resident.border },
                      ]}
                    />
                  ) : null}
                </View>
                <View style={[styles.stepBody, isLast && styles.lastStepBody]}>
                  <View style={styles.stepTitleRow}>
                  <ThemedText
                    style={[styles.stepTitle, { color: isCurrent ? theme.resident.accentText : isDone ? theme.resident.text : theme.resident.muted }]}>
                    {STEP_LABEL[step]}
                  </ThemedText>
                  {isCurrent ? <ThemedText style={[styles.currentPill, { color: theme.resident.accentText, backgroundColor: theme.resident.accentSoft }]}>{step === 'completed' ? 'Done' : 'Current'}</ThemedText> : null}
                  </View>
                  {entry ? (
                    <>
                      <ThemedText style={[styles.stepMeta, { color: theme.resident.muted }]}>
                        {formatDateTime(entry.at)}
                      </ThemedText>
                      {entry.note ? (
                        <View>
                          <View style={[styles.noteChip, { backgroundColor: theme.resident.surface }]}>
                            <ThemedText style={[styles.stepMeta, { color: theme.resident.muted }]}>
                              {entry.note}
                            </ThemedText>
                          </View>
                        </View>
                      ) : null}
                    </>
                  ) : (
                    <ThemedText style={[styles.stepMeta, { color: theme.resident.muted }]}>
                      Pending
                    </ThemedText>
                  )}
                </View>
              </View>
            );
          })}
          </View>

          {isCancelled ? (
            <View>
              <ThemedText type="small" style={[styles.cancelledNote, { color: theme.resident.danger, backgroundColor: theme.resident.dangerSoft }]}>
                This request was cancelled.
                {(() => {
                  const cancelEntry = history.find((h) => h.status === 'cancelled');
                  return cancelEntry ? ` ${formatDateTime(cancelEntry.at)}${cancelEntry.note ? ` · ${cancelEntry.note}` : ''}` : '';
                })()}
              </ThemedText>
            </View>
          ) : null}
        </ThemedView>

        <View accessibilityLabel="Request details" style={[styles.details, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
          <View style={[styles.detailsHeader, { borderColor: theme.resident.border }]}>
            <Ionicons name="document-text-outline" size={18} color={theme.resident.accentText} accessible={false} />
            <ThemedText accessibilityRole="header" style={styles.sectionLabel}>Request details</ThemedText>
          </View>
          {[
            ['Submitted', formatDateTime(request.created_at)],
            ...(request.purpose_label ? [['Purpose', request.purpose_label]] : []),
            ...(request.purpose_explanation ? [['Purpose explanation', request.purpose_explanation]] : []),
            ...submittedDetailLines(request.supporting_details),
            ...(request.requester_notes ? [['Additional notes', request.requester_notes]] : []),
          ].map(([label, value], index) => <View key={`${label}:${index}`} style={[styles.detailRow, { borderColor: theme.resident.border }]}>
            <ThemedText style={[styles.detailLabel, { color: theme.resident.muted }]}>{label}</ThemedText>
            <ThemedText selectable style={styles.detailValue}>{value}</ThemedText>
          </View>)}
        </View>
        </TrackingReveal>
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
  root: { flex: 1 },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  sections: { gap: 12 },

  hero: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingVertical: 2 },
  heroIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontSize: 18, lineHeight: 23, fontWeight: '800' },
  details: { borderWidth: 1, borderRadius: 18, overflow: 'hidden' },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  detailRow: { paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  detailLabel: { fontSize: 12, lineHeight: 18, width: 88 },
  detailValue: { fontSize: 13, lineHeight: 19, fontWeight: '600', flex: 1, minWidth: 160 },
  sectionLabel: {
    fontSize: 14, lineHeight: 20, fontWeight: '700', flex: 1,
  },

  progressCard: {
    padding: 14,
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
    padding: 14,
    borderRadius: 18,
    gap: 14,
  },
  timelineHeading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stageCount: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  step: {
    flexDirection: 'row',
    gap: 10,
  },
  stepIndicator: {
    alignItems: 'center',
  },
  stepDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepLine: {
    width: 2,
    flex: 1,
    minHeight: 22,
    marginVertical: 3,
  },
  stepBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingBottom: 14,
  },
  lastStepBody: { paddingBottom: 0 },
  stepTitleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', minHeight: 26 },
  stepTitle: { fontSize: 13, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
  stepNumber: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  stepMeta: { fontSize: 12, lineHeight: 17 },
  currentPill: { fontSize: 10, lineHeight: 15, fontWeight: '700', paddingHorizontal: 7, paddingVertical: 1, borderRadius: 6 },
  noteChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 2,
  },
  cancelledNote: {
    padding: 10, borderRadius: 10, fontSize: 12, lineHeight: 18,
  },
  paymentCard: { gap: 0, borderRadius: 18 },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  paymentSummary: { paddingHorizontal: 14, paddingTop: 12, gap: 8, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' },
  amountLabel: { fontSize: 12, lineHeight: 18 },
  paymentAmount: { fontSize: 23, lineHeight: 30, fontWeight: '800', flexShrink: 1 },
  pillText: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  pickupMessage: { fontSize: 12, lineHeight: 18, paddingHorizontal: 14, paddingBottom: 2 },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingTop: 8, paddingBottom: 10, gap: 10,
  },
  paymentMethodCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two, flex: 1, minWidth: 0,
  },
  paymentStatusPill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Spacing.four,
  },
  buttonSlot: {
    margin: 14,
    marginTop: 10,
    gap: 8,
  },

  /* Loading skeleton */
  skeletonContainer: {
    flex: 1,
    padding: Spacing.four,
  },
  skeletonGap: {
    marginTop: Spacing.three,
  },
});
