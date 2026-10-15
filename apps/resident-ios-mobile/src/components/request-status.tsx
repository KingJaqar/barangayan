import { getResidentRequestStatus, RESIDENT_STATUS_LABEL, type ResidentRequestStatus } from '@barangayan/shared';
import type { IconName } from '@expo/ui';
import { StatusBadge, type StatusTone } from './ui';

const presentation: Record<ResidentRequestStatus, { icon: IconName; tone: StatusTone }> = {
  pending_payment: { icon: 'exclamationmark.circle', tone: 'warning' },
  paid: { icon: 'tray.and.arrow.down', tone: 'info' },
  processing: { icon: 'clock', tone: 'info' },
  ready_for_pickup: { icon: 'shippingbox', tone: 'success' },
  completed: { icon: 'checkmark.circle', tone: 'success' },
  cancelled: { icon: 'xmark.circle', tone: 'neutral' },
};
/** Existing shared resident status label with an icon; the label semantics are unchanged here. */
export function RequestStatus({ status, paymentStatus }: { status: string; paymentStatus: string }) {
  const resident = getResidentRequestStatus(status, paymentStatus);
  return <StatusBadge label={RESIDENT_STATUS_LABEL[resident]} {...presentation[resident]} />;
}
