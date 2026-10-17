import { useLocalSearchParams } from 'expo-router';
import { ReceiptRoute } from '../../../features/payments/receipt-screen';

export default function PaymentReceiptRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return <ReceiptRoute key={requestId} />;
}
