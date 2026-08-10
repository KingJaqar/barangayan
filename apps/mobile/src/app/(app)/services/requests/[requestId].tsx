import { Ionicons } from '@expo/vector-icons';
import { estimateLabel, formatCentavosAsPHP, formatDateTime, progressFraction, type Tables } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card } from '@/components/card';
import { Divider } from '@/components/divider';
import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

type ServiceRequest = Tables<'service_requests'> & {
  document_types: Pick<Tables<'document_types'>, 'name' | 'processing_target_hours' | 'fee_centavos'> | null;
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
  const theme = useTheme();
  const [request, setRequest] = useState<ServiceRequest | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    function load() {
      supabase
        .from('service_requests')
        .select('*, document_types(name, processing_target_hours, fee_centavos)')
        .eq('id', requestId)
        .single()
        .then(({ data }) => {
          if (!cancelled) setRequest(data as ServiceRequest | null);
        });
    }

    load();

    // Realtime: this screen reflects status changes live, without a manual refresh.
    const channel = supabase
      .channel(`service-request-${requestId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'service_requests', filter: `id=eq.${requestId}` },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [requestId]);

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          {request.document_types?.name ?? 'Document Request'}
        </ThemedText>
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
            <View style={[styles.paymentStatusPill, { backgroundColor: isPaid ? `${theme.primary}26` : `${theme.textSecondary}1A` }]}>
              <ThemedText type="small" style={{ color: isPaid ? theme.primary : theme.textSecondary }}>
                {isPaid ? 'Paid' : 'Pending'}
              </ThemedText>
            </View>
          </View>
          <View style={styles.paymentAmountRow}>
            <ThemedText type="small" themeColor="textSecondary">Amount Due</ThemedText>
            <ThemedText type="smallBold">
              {fee === 0 ? 'Free' : formatCentavosAsPHP(fee)}
            </ThemedText>
          </View>
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
  title: {
    fontSize: 24,
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
