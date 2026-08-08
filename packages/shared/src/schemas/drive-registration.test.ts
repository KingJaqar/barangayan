import { describe, expect, it } from 'vitest';

import { driveRegistrationSchema } from './drive-registration';

describe('driveRegistrationSchema', () => {
  const valid = {
    driveId: '11111111-1111-1111-1111-111111111111',
    age: 34,
    isPwd: false,
    comorbidities: [],
  };

  it('parses a valid registration', () => {
    expect(driveRegistrationSchema.safeParse(valid).success).toBe(true);
  });

  it('parses a valid registration with priorDoseDate', () => {
    const result = driveRegistrationSchema.safeParse({ ...valid, priorDoseDate: '2026-01-15' });
    expect(result.success).toBe(true);
  });

  it('rejects a negative age', () => {
    const result = driveRegistrationSchema.safeParse({ ...valid, age: -1 });
    expect(result.success).toBe(false);
  });

  it('rejects an age over 130', () => {
    const result = driveRegistrationSchema.safeParse({ ...valid, age: 131 });
    expect(result.success).toBe(false);
  });

  it('rejects a non-uuid driveId', () => {
    const result = driveRegistrationSchema.safeParse({ ...valid, driveId: 'nope' });
    expect(result.success).toBe(false);
  });

  it('defaults comorbidities to an empty array when omitted', () => {
    const { driveId, age, isPwd } = valid;
    const result = driveRegistrationSchema.safeParse({ driveId, age, isPwd });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.comorbidities).toEqual([]);
    }
  });
});
