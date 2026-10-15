import { formatCentavosAsPHP, requestFee, requestFeeLabel, type Tables } from '@barangayan/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { ServiceScreenHeader } from '@/components/services/service-screen-header';
import { ThemedText } from '@/components/themed-text';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
type Request = Tables<'service_requests'> & {
  document_types: { name: string; fee_centavos: number; service_kind: string | null } | null;
  payments: { status: string; document_fee_centavos: number | null; amount_centavos: number }[];
};
export function ResidentPaymentScreen({
  requestId,
  pickup = false,
}: {
  requestId: string;
  pickup?: boolean;
}) {
  const theme = useTheme();
  const router = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [pages, setPages] = useState('1');
  const [confirmed, setConfirmed] = useState(false);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
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
  }, [requestId]);
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
      setError((failure as { message: string }).message);
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
    const { error: choiceError } = await supabase.rpc('set_service_request_payment_method', {
      p_request_id: requestId,
      p_method: 'qrph',
    });
    setPending(false);
    busy.current = false;
    if (choiceError) setError(choiceError.message);
    else router.push(`/services/payment/qrph/${requestId}`);
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
    } catch (failure) {setError((failure as {message:string}).message);}
    finally {busy.current=false; setPending(false);}
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.primary }}>
      <ServiceScreenHeader
        title={pickup ? "Payment" : "Payment Method"}
        backLabel="Back to Services"
        onBack={() => router.replace('/services?segment=requests')}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.background }}
        contentContainerStyle={{ padding: 20, gap: 20 }}>
        {request ? (
          <>
            <ThemedText type="subtitle">{request.document_types?.name ?? 'Document Request'}</ThemedText>
            <ThemedText>Ref #{request.reference_number}</ThemedText>
            <View style={{ padding: 20, borderWidth: 1, borderColor: '#8888', borderRadius: 16, gap: 12 }}>
              <ThemedText type="smallBold">
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
                <ThemedText type="title">{formatCentavosAsPHP(amount)}</ThemedText>
              ) : (
                <ThemedText>
                  {requestFeeLabel(request, amount)}
                </ThemedText>
              )}
              {request.billable_pages ? <ThemedText>{request.billable_pages} pages × ₱10.00 per page</ThemedText> : null}
            </View>
            {request.fee_assessment_state === 'page_count_required' && !['completed', 'cancelled'].includes(request.status) ? <>
              <ThemedText>Total pages across all copies</ThemedText>
              <TextInput accessibilityLabel="Total pages across all copies" keyboardType="number-pad" value={pages} onChangeText={setPages} editable={!pending} style={{borderWidth:1,borderColor:theme.textSecondary,color:theme.text,padding:12,borderRadius:8}} />
              <ThemedText>₱10.00 per page</ThemedText>
              <PrimaryButton label="Continue to payment methods" loading={pending} onPress={() => void savePages()} />
            </> : null}
            {payable ? (
              confirmed ? (
                <ThemedText>
                  Pay {amount === null ? 'the applicable tax-code fee' : formatCentavosAsPHP(amount)} in cash when you pick up the document at the Barangay
                  Hall. Your pickup payment has been recorded.
                </ThemedText>
              ) : (
                <>
                  <PrimaryButton label="Pay at Pickup" loading={pending} onPress={() => pickup ? void startPickup() : router.push(`/services/payment/pickup/${requestId}`)} />
                  {!pickupOnly && PAYMENT_SETTLEMENT_READY && amount !== null && amount >= 100 ? (
                    <PrimaryButton label="Pay with QR PH" disabled={pending} onPress={() => void startQr()} />
                  ) : !pickupOnly ? (
                    <ThemedText type="small">
                      QR PH setup is in progress. Pay at Pickup is available.
                    </ThemedText>
                  ) : null}
                </>
              )
            ) : null}
            <PrimaryButton
              label="View My Requests"
              variant="secondary"
              onPress={() => router.replace('/services?segment=requests')}
            />
          </>
        ) : !error ? (
          <ThemedText>Loading payment details…</ThemedText>
        ) : null}
        {error ? (
          <ThemedText accessibilityRole="alert" themeColor="accentRed">
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton
          label={error ? 'Retry loading payment details' : 'Refresh payment details'}
          variant="secondary"
          onPress={() => void refresh()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
