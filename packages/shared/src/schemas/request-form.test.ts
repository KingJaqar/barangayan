import { describe, expect, it } from 'vitest';

import { requestFormSchema } from './request-form';

describe('requestFormSchema', () => {
  it('parses a valid minimal submission', () => {
    const result = requestFormSchema.safeParse({
      documentTypeId: '11111111-1111-1111-1111-111111111111',
    });
    expect(result.success).toBe(true);
  });

  it('parses a valid submission with optional fields', () => {
    const result = requestFormSchema.safeParse({
      documentTypeId: '11111111-1111-1111-1111-111111111111',
      requesterNotes: 'Employment requirement',
      appointmentSlot: { date: '2026-08-10', timeSlot: '09:00-09:30' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing documentTypeId', () => {
    const result = requestFormSchema.safeParse({ requesterNotes: 'no doc type' });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid documentTypeId', () => {
    const result = requestFormSchema.safeParse({ documentTypeId: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });

  it('rejects requesterNotes over 1000 chars', () => {
    const result = requestFormSchema.safeParse({
      documentTypeId: '11111111-1111-1111-1111-111111111111',
      requesterNotes: 'a'.repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});
