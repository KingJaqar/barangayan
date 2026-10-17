import { useLocalSearchParams } from 'expo-router';
import { PaymentRoute } from '../../../features/payments/payment-screen';

export default function PaymentOptionsRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  // Keyed by request so a different request never inherits the previous one's entries and messages.
  return <PaymentRoute key={requestId} intent="choose" />;
}
