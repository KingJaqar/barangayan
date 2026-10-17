import { useLocalSearchParams } from 'expo-router';
import { PaymentRoute } from '../../../../features/payments/payment-screen';

export default function PickupPaymentRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return <PaymentRoute key={requestId} intent="pickup" />;
}
