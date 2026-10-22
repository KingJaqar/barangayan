import { formatCentavosAsPHP } from '@barangayan/shared';
import { ActionSuccessModal } from '@/components/services/action-success-modal';

export function PaymentSuccessModal({ visible, amountCentavos, onConfirm }: {
  visible: boolean;
  amountCentavos: number;
  onConfirm: () => void;
}) {
  return <ActionSuccessModal visible={visible} title="Payment Successful"
    amountLabel={formatCentavosAsPHP(amountCentavos)} message="We've received your payment via QR PH." onConfirm={onConfirm} />;
}
