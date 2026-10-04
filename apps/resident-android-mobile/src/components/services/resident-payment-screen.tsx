import { formatCentavosAsPHP, requestFee, type Tables } from '@barangayan/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { PAYMENT_SETTLEMENT_READY } from '@/constants/payment';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';
type Request = Tables<'service_requests'> & {
  document_types: { name: string; fee_centavos: number } | null;
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
  const [confirmed, setConfirmed] = useState(false);
  const busy = useRef(false);
  const refresh = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('service_requests')
      .select(
        '*, document_types(name, fee_centavos), payments(status, document_fee_centavos, amount_centavos)',
      )
      .eq('id', requestId)
      .single();
    if (queryError) {
      setError('Could not load the request and assessment. Reconnect and retry.');
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
    if (pickup && amount !== null && amount > 0 && request?.payment_status !== 'paid') void startPickup();
  }, [pickup, amount, request?.payment_status, startPickup]);
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
    amount !== null &&
    amount > 0 &&
    request?.payment_status !== 'paid' &&
    !['cancelled', 'completed'].includes(request?.status ?? '');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }}>
        <PrimaryButton
          label="Back to Services"
          variant="secondary"
          onPress={() => router.replace('/services?segment=requests')}
        />
        {request ? (
          <>
            <ThemedText type="subtitle">{request.document_types?.name ?? 'Document Request'}</ThemedText>
            <ThemedText>Ref #{request.reference_number}</ThemedText>
            <View style={{ padding: 20, borderWidth: 1, borderColor: '#8888', borderRadius: 16, gap: 12 }}>
              <ThemedText type="smallBold">
                {amount === null
                  ? 'Awaiting fee assessment'
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
                  Staff will review the requirements and confirm your amount or exemption before payment.
                </ThemedText>
              )}
              {request.fee_basis ? <ThemedText>{request.fee_basis}</ThemedText> : null}
            </View>
            {payable ? (
              confirmed ? (
                <ThemedText>
                  Pay {formatCentavosAsPHP(amount!)} in cash when you pick up the document at the Barangay
                  Hall. Your pickup payment has been recorded.
                </ThemedText>
              ) : (
                <>
                  <PrimaryButton label="Pay at Pickup" loading={pending} onPress={() => void startPickup()} />
                  {PAYMENT_SETTLEMENT_READY && amount! >= 100 ? (
                    <PrimaryButton label="Pay with QR PH" disabled={pending} onPress={() => void startQr()} />
                  ) : (
                    <ThemedText type="small">
                      QR PH setup is in progress. Pay at Pickup is available.
                    </ThemedText>
                  )}
                </>
              )
            ) : null}
            <PrimaryButton
              label="View My Request"
              variant="secondary"
              onPress={() => router.push(`/services/requests/${requestId}`)}
            />
          </>
        ) : !error ? (
          <ThemedText>Loading request and fee assessment…</ThemedText>
        ) : null}
        {error ? (
          <ThemedText accessibilityRole="alert" themeColor="accentRed">
            {error}
          </ThemedText>
        ) : null}
        <PrimaryButton
          label={error ? 'Retry loading assessment' : 'Refresh assessment'}
          variant="secondary"
          onPress={() => void refresh()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
