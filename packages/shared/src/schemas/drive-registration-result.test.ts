import { describe, expect, it } from 'vitest';
import { residentDriveRegistrationResultSchema } from './drive-registration';

describe('resident health registration response', () => {
  const result = { registration_id: '10000000-0000-0000-0000-000000000001', applicant_number: 'VAC-20261004-0001', status: 'pending' };
  it('keeps applicant and status while stripping legacy score and extra fields', () => {
    expect(residentDriveRegistrationResultSchema.parse({ ...result, priority_score: 80, score: { priority_score: 80 } })).toEqual(result);
  });
  it.each([{ ...result, registration_id: 'invalid' }, { ...result, applicant_number: '' }, { ...result, status: 'unknown' }, null])('rejects invalid confirmations: %s', (value) => {
    expect(residentDriveRegistrationResultSchema.safeParse(value).success).toBe(false);
  });
});
