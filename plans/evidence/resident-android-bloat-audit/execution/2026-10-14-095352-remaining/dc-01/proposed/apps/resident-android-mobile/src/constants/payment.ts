

/**
 * Single source of truth for whether QR PH can complete a real transaction. Flipping
 * this to 'true' (once a settlement bank account is registered in the PayMongo
 * dashboard — see the plan's Part G) is the only mobile-side change needed to go live;
 * the UI, hook, and Edge Functions are already built and dormant behind this flag.
 * Defaults to 'false' (any value other than the literal string 'true' stays gated).
 */
export const PAYMENT_SETTLEMENT_READY = process.env.EXPO_PUBLIC_QRPH_SETTLEMENT_READY === 'true';
