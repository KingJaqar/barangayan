import { Banknote, QrCode } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PaymentMethod } from '@barangayan/shared';

/**
 * Recreated from apps/resident-android-mobile/src/constants/payment.ts — not exported
 * from @barangayan/shared, so both apps carry their own copy (see the plan's C-042-
 * adjacent note). Single source of truth for whether QR PH can complete a real
 * transaction; flipping NEXT_PUBLIC_QRPH_SETTLEMENT_READY to 'true' is the only change
 * needed to go live. Defaults to gated (anything other than the literal string 'true').
 */
export const PAYMENT_SETTLEMENT_READY = process.env.NEXT_PUBLIC_QRPH_SETTLEMENT_READY === 'true';

export interface PaymentMethodOption {
  key: PaymentMethod;
  label: string;
  subtitle: string;
  icon: LucideIcon;
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    key: 'pickup',
    label: 'Pay at Pickup',
    subtitle: 'Pay in person when you pick up your document at the Barangay Hall.',
    icon: Banknote,
  },
  {
    key: 'qrph',
    label: 'QR PH',
    subtitle: "Pay instantly via GCash, Maya, or your bank's QR PH app.",
    icon: QrCode,
  },
];
