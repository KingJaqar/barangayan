import type { PaymentMethod } from '@barangayan/shared';

/**
 * Single source of truth for whether QR PH can complete a real transaction. Flipping
 * this to 'true' (once a settlement bank account is registered in the PayMongo
 * dashboard — see the plan's Part G) is the only mobile-side change needed to go live;
 * the UI, hook, and Edge Functions are already built and dormant behind this flag.
 * Defaults to 'false' (any value other than the literal string 'true' stays gated).
 */
export const PAYMENT_SETTLEMENT_READY = process.env.EXPO_PUBLIC_QRPH_SETTLEMENT_READY === 'true';

export interface PaymentMethodOption {
  key: PaymentMethod;
  label: string;
  subtitle: string;
  icon: 'cash-outline' | 'qr-code-outline';
}

export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    key: 'pickup',
    label: 'Pay at Pickup',
    subtitle: 'Pay in person when you pick up your document at the Barangay Hall.',
    icon: 'cash-outline',
  },
  {
    key: 'qrph',
    label: 'QR PH',
    subtitle: "Pay instantly via GCash, Maya, or your bank's QR PH app.",
    icon: 'qr-code-outline',
  },
];
