import { useLocalSearchParams } from 'expo-router';
import { QrRoute } from '../../../../features/payments/qr-screen';

export default function QrPaymentRoute() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  return <QrRoute key={requestId} />;
}
