import { z } from 'zod';

/** The two payment methods offered on the mobile Payment screen: pay in cash at pickup
 * ('pickup'), or QR PH. QR PH stays selectable in the UI even while gated by
 * EXPO_PUBLIC_QRPH_SETTLEMENT_READY — this schema just describes the shape, not the
 * gating (that's a client-side concern, not a validation rule, since an ungated QR PH
 * submission should never reach here). */
export const paymentMethodSchema = z.enum(['pickup', 'qrph']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

/** Admin-side cancellation payload — mirrors the cancel_service_request RPC's args. */
export const cancelRequestSchema = z.object({
  requestId: z.string().uuid(),
  note: z.string().min(1, 'A cancellation reason is required.').max(500),
});
export type CancelRequestInput = z.infer<typeof cancelRequestSchema>;

/**
 * PayMongo's `source.chargeable` webhook payload shape (subset — only the fields the
 * paymongo-webhook Edge Function reads). Not exhaustive of PayMongo's full API surface;
 * extend as needed once the webhook is exercised against real sandbox payloads.
 */
export const paymongoWebhookEventSchema = z.object({
  data: z.object({
    attributes: z.object({
      type: z.literal('source.chargeable'),
      data: z.object({
        id: z.string(),
        attributes: z.object({
          status: z.enum(['pending', 'chargeable', 'paid', 'expired', 'cancelled']),
          amount: z.number().int(),
        }),
      }),
    }),
  }),
});
export type PaymongoWebhookEvent = z.infer<typeof paymongoWebhookEventSchema>;
