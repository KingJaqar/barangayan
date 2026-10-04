import { useLocalSearchParams } from 'expo-router';
import { ResidentPaymentScreen } from '@/components/services/resident-payment-screen';
export default function PaymentScreen(){const {requestId}=useLocalSearchParams<{requestId:string}>();return <ResidentPaymentScreen key={requestId} requestId={requestId} />;}
