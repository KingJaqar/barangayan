import { formatCentavosAsPHP, requestFee, requestFeeLabel, type Tables } from '@barangayan/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { PaymentMethodRow } from '@/components/services/payment-method-row';
import { PrimaryButton } from '@/components/primary-button';
import { PullRefreshControl, usePullRefresh } from '@/components/pull-refresh';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ThemedText } from '@/components/themed-text';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
type Request = Tables<'service_requests'> & {
  document_types: { name: string; fee_centavos: number; service_kind: string | null } | null;
  payments: { status: string; document_fee_centavos: number | null; amount_centavos: number }[];
};
function paymentErrorMessage(failure: unknown, fallback: string): string {
  if (typeof failure === 'object' && failure !== null && 'message' in failure && typeof failure.message === 'string' && failure.message.trim()) return failure.message;
  return fallback;
}

export function ResidentPaymentScreen({
  requestId,
  pickup = false,
}: {
  requestId: string;
  pickup?: boolean;
}) {
  const theme = useTheme();
  const { fontId } = useFontPreference();
  const router = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pages, setPages] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    try {
      const { data, error: queryError } = await supabase
        .from('service_requests')
        .select(
          '*, document_types(name, fee_centavos, service_kind), payments(status, document_fee_centavos, amount_centavos)',
        )
        .eq('id', requestId)
        .single();
      if (queryError) {
        setError('Could not load the payment details. Reconnect and retry.');
        setRequest(null);
      } else {
        setRequest(data);
        setError(null);
      }
    } catch { setError('Could not load the payment details. Reconnect and retry.'); setRequest(null); }
  }, [requestId]);
  const pull = usePullRefresh([refresh]);
  useFocusEffect(
    useCallback(() => {
      void refresh();
      const timer = setInterval(() => void refresh(), 10000);
      return () => clearInterval(timer);
    }, [refresh]),
  );
  const recorded =
    request?.payments.find((payment) => ['paid', 'pending'].includes(payment.status)) ?? request?.payments[0];
  const amount = request
    ? requestFee(
        request,
        request.document_types?.fee_centavos ?? 0,
        recorded?.document_fee_centavos ?? recorded?.amount_centavos,
      )
    : null;
  const startPickup = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const { error: choiceError } = await supabase.rpc('set_service_request_payment_method', {
        p_request_id: requestId,
        p_method: 'pickup',
      });
      if (choiceError) throw choiceError;
      const { error: paymentError } = await supabase.rpc('start_pickup_payment', { p_request_id: requestId });
      if (paymentError) throw paymentError;
      setConfirmed(true);
    } catch (failure) {
      setError(paymentErrorMessage(failure, 'Could not record pickup payment. Please try again.'));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }, [requestId]);
  useEffect(() => {
    if (pickup && (request?.fee_assessment_state === 'pickup_due' || (amount !== null && amount > 0)) && request?.payment_status !== 'paid') void startPickup();
  }, [pickup, amount, request?.fee_assessment_state, request?.payment_status, startPickup]);
  async function startQr() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(null);
    try {
      const { error: choiceError } = await supabase.rpc('set_service_request_payment_method', {
        p_request_id: requestId,
        p_method: 'qrph',
      });
      if (choiceError) setError(choiceError.message);
      else router.push(`/services/payment/qrph/${requestId}`);
    } catch { setError('Could not select QR PH. Reconnect and try again.'); }
    finally { setPending(false); busy.current = false; }
  }
  const payable =
    (request?.fee_assessment_state === 'pickup_due' || (amount !== null && amount > 0)) &&
    request?.payment_status !== 'paid' &&
    !['cancelled', 'completed'].includes(request?.status ?? '');
  const pickupOnly = request?.document_types?.service_kind === 'business' || request?.fee_assessment_state === 'pickup_due';
  async function savePages() {
    if (busy.current) return;
    const count = Number(pages);
    if (!Number.isInteger(count) || count < 1 || count > 1000000) { setError('Enter a whole page count between 1 and 1,000,000.'); return; }
    busy.current = true; setPending(true);
    try {
      const {error: failure} = await supabase.rpc('set_service_request_pages', {p_request_id:requestId,p_total_pages:count});
      if (failure) throw failure;
      await refresh();
    } catch (failure) {setError(paymentErrorMessage(failure, 'Could not save the page count. Please try again.'));}
    finally {busy.current=false; setPending(false);}
  }
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={{ flex: 1, backgroundColor: theme.resident.accent }}>
      <ServiceScreenHeader
        compact
        title={pickup ? "Payment" : "Payment Method"}
        backLabel="Back to Services"
        onBack={() => router.replace('/services?segment=requests')}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.resident.card }}
        refreshControl={<PullRefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} />}
        contentContainerStyle={styles.content}>
        {request ? (
          <>
            <View style={styles.requestSummary}>
              <ThemedText style={styles.title}>{request.document_types?.name ?? 'Document Request'}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">Ref #{request.reference_number}</ThemedText>
            </View>
            <View style={[styles.feeCard, { backgroundColor: theme.resident.accentSoft, borderColor: theme.resident.border }]}>
              <ThemedText type="smallBold" style={{ color: theme.resident.accentText }}>
                {amount === null
                  ? 'Document Fee'
                  : request.fee_assessment_state === 'waived'
                    ? 'Fee waived — no payment required'
                    : request.payment_status === 'paid'
                      ? 'Payment received'
                      : amount === 0
                        ? 'No payment required'
                        : 'Confirmed amount due'}
              </ThemedText>
              {amount !== null ? (
                <ThemedText type="subtitle" style={styles.amount}>{formatCentavosAsPHP(amount)}</ThemedText>
              ) : (
                <ThemedText>
                  {requestFeeLabel(request, amount)}
                </ThemedText>
              )}
              {request.billable_pages ? <ThemedText type="small" themeColor="textSecondary">{request.billable_pages} pages · {request.fee_basis}</ThemedText> : null}
            </View>
            {request.fee_assessment_state === 'page_count_required' && !['completed', 'cancelled'].includes(request.status) ? <View style={styles.actionGroup}>
              <ThemedText>Total pages across all copies</ThemedText>
              <TextInput accessibilityLabel="Total pages across all copies" keyboardType="number-pad" value={pages} onChangeText={setPages} editable={!pending} style={[styles.pageInput, {borderColor:theme.resident.controlBorder,color:theme.resident.text,fontFamily:getMobileFontFamily(fontId)}]} />
              <ThemedText type="small" themeColor="textSecondary">₱10.00 per page</ThemedText>
              <PrimaryButton presentation="resident" label="Continue to payment methods" loading={pending} onPress={() => void savePages()} />
            </View> : null}
            {payable ? (
              confirmed ? (
                <View style={[styles.confirmation, { backgroundColor: theme.resident.card, borderColor: theme.resident.border }]}>
                  <Ionicons name="checkmark-circle-outline" size={20} color={theme.resident.accentText} accessible={false} />
                  <ThemedText style={styles.confirmationText}>
                    Pay {amount === null ? 'the applicable tax-code fee' : formatCentavosAsPHP(amount)} in cash when you pick up the document at the Barangay Hall. Your pickup payment has been recorded.
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.actionGroup}>
                  <ThemedText style={styles.methodHeading}>{pickup ? 'Confirm pickup payment' : 'How would you like to pay?'}</ThemedText>
                  <View style={[styles.methods, { borderColor: theme.resident.border }]}>
                    <PaymentMethodRow label={pending ? 'Recording pickup payment…' : 'Pay at Pickup'} icon="cash-outline"
                      description="Pay in cash at the Barangay Hall when you collect your document." disabled={pending}
                      onPress={() => pickup ? void startPickup() : router.push(`/services/payment/pickup/${requestId}`)} />
                    <PaymentMethodRow label="Pay with QR PH" icon="qr-code-outline"
                      description={pickupOnly ? 'Not available for fees assessed at pickup.' : !PAYMENT_SETTLEMENT_READY ? 'QR PH setup is in progress. Pay at Pickup is available.' : amount === null || amount < 100 ? 'QR PH requires a confirmed fee of at least PHP 1.00.' : 'Scan with GCash, Maya, or your bank’s app.'}
                      disabled={pending || pickupOnly || !PAYMENT_SETTLEMENT_READY || amount === null || amount < 100}
                      onPress={() => void startQr()} />
                  </View>
                </View>
              )
            ) : null}
            <PrimaryButton presentation="resident"
              label="View My Requests"
              variant="secondary"
              onPress={() => router.replace('/services?segment=requests')}
            />
          </>
        ) : !error ? (
          <ThemedText>Loading payment details…</ThemedText>
        ) : null}
        {error ? (
          <ThemedText accessibilityRole="alert" style={{ color: theme.resident.danger }}>
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton presentation="resident"
          label={error ? 'Retry loading payment details' : 'Refresh payment details'}
          leadingIcon={<Ionicons name="refresh-outline" size={16} color={theme.resident.text} accessible={false} />}
          variant="secondary"
          onPress={() => void refresh()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 16 },
  requestSummary: { gap: 4 },
  feeCard: { paddingHorizontal: 20, paddingVertical: 16, borderRadius: 16, gap: 4 },
  amount: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 21, lineHeight: 26, fontWeight: '800' },
  methodHeading: { fontSize: 17, lineHeight: 23, fontWeight: '700', marginTop: 8 },
  methods: { boxShadow: '0 2px 10px rgba(0,0,0,0.05)', borderWidth: 1, borderTopWidth: 0, borderRadius: 16, overflow: 'hidden' },
  confirmation: { boxShadow: '0 2px 10px rgba(0,0,0,0.05)', flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 16, borderWidth: 1, padding: 16 },
  confirmationText: { flex: 1, fontSize: 15, lineHeight: 22 },
  actionGroup: { gap: 8 },
  pageInput: { minHeight: 48, borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 16 },
});
