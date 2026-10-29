import { describe, expect, it } from 'vitest';
import { homeRequestAttention, type HomeRequestRow } from './home-request-priority';

const request: Parameters<typeof homeRequestAttention>[0] = {
  status: 'submitted', payment_status: 'pending', payment_method: null,
  fee_assessment_state: 'assessed', sla_state: 'pre_processing', resolved_fee_centavos: 1000,
};

describe('Home attention contract (migration 0148 parity)', () => {
  it.each([
    [{}, false, 'choose_payment'],
    [{ resolved_fee_centavos: null }, true, null],
    [{ resolved_fee_centavos: 0 }, true, null],
    [{ resolved_fee_centavos: -1 }, true, null],
    [{ resolved_fee_centavos: NaN }, true, null],
    [{ resolved_fee_centavos: Infinity }, true, null],
    [{ payment_method: 'pickup' }, true, null],
    [{ payment_method: 'unknown' }, true, null],
    [{ payment_method: 'qrph' }, false, null],
    [{ payment_method: 'qrph' }, true, 'pay'],
    [{ payment_method: 'qrph', resolved_fee_centavos: 99 }, true, null],
    [{ payment_method: 'qrph', resolved_fee_centavos: 100 }, true, 'pay'],
    [{ payment_status: 'paid' }, true, null],
    [{ payment_status: 'waived' }, true, null],
    [{ payment_status: 'refunded' }, true, null],
    [{ payment_status: 'failed' }, false, 'choose_payment'],
    [{ fee_assessment_state: 'page_count_required', resolved_fee_centavos: null }, false, 'enter_pages'],
    [{ fee_assessment_state: 'page_count_required', payment_status: 'paid', resolved_fee_centavos: null }, false, null],
    [{ sla_state: 'paused', resolved_fee_centavos: null }, false, 'review_requirements'],
    [{ status: 'ready_for_pickup', payment_status: 'paid', resolved_fee_centavos: null }, false, 'collect'],
    [{ status: 'in_progress' }, false, 'choose_payment'],
    [{ status: 'completed', sla_state: 'paused' }, true, null],
    [{ status: 'cancelled', fee_assessment_state: 'page_count_required' }, true, null],
    [{ status: 'unknown', sla_state: 'paused' }, true, null],
  ] satisfies [Partial<HomeRequestRow>, boolean, HomeRequestRow['next_action']][])(
    'maps %j (QR settlement %s) to %s', (changes, capability, action) => {
      expect(homeRequestAttention({ ...request, ...changes }, capability)).toBe(action);
    },
  );
});
