import { describe, expect, it } from 'vitest';

import { cancelRequestSchema, paymentMethodSchema, paymongoWebhookEventSchema } from './payment';

describe('paymentMethodSchema', () => {
  it('accepts cash', () => {
    expect(paymentMethodSchema.safeParse('cash').success).toBe(true);
  });

  it('accepts qrph', () => {
    expect(paymentMethodSchema.safeParse('qrph').success).toBe(true);
  });

  it('rejects an unknown method', () => {
    expect(paymentMethodSchema.safeParse('bank_transfer').success).toBe(false);
  });
});

describe('cancelRequestSchema', () => {
  it('parses a valid cancellation', () => {
    const result = cancelRequestSchema.safeParse({
      requestId: '11111111-1111-1111-1111-111111111111',
      note: 'Duplicate request',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an empty note', () => {
    const result = cancelRequestSchema.safeParse({
      requestId: '11111111-1111-1111-1111-111111111111',
      note: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid requestId', () => {
    const result = cancelRequestSchema.safeParse({ requestId: 'nope', note: 'Reason' });
    expect(result.success).toBe(false);
  });
});

describe('paymongoWebhookEventSchema', () => {
  it('parses a valid source.chargeable event', () => {
    const result = paymongoWebhookEventSchema.safeParse({
      data: {
        attributes: {
          type: 'source.chargeable',
          data: {
            id: 'src_123',
            attributes: { status: 'chargeable', amount: 5000 },
          },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a mismatched event type', () => {
    const result = paymongoWebhookEventSchema.safeParse({
      data: {
        attributes: {
          type: 'source.expired',
          data: { id: 'src_123', attributes: { status: 'expired', amount: 5000 } },
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid status', () => {
    const result = paymongoWebhookEventSchema.safeParse({
      data: {
        attributes: {
          type: 'source.chargeable',
          data: { id: 'src_123', attributes: { status: 'not-a-status', amount: 5000 } },
        },
      },
    });
    expect(result.success).toBe(false);
  });
});
