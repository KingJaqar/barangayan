import { describe, expect, it } from 'vitest';

import { documentTypeSchema } from './document-type';

describe('documentTypeSchema', () => {
  const valid = {
    name: 'Barangay Clearance',
    feeCentavos: 5000,
    processingTargetHours: 24,
  };

  it('parses a valid document type', () => {
    const result = documentTypeSchema.safeParse(valid);
    expect(result.success).toBe(true);
  });

  it('defaults requirements to an empty array and isActive to true', () => {
    const result = documentTypeSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.requirements).toEqual([]);
      expect(result.data.isActive).toBe(true);
    }
  });

  it('rejects an empty name', () => {
    const result = documentTypeSchema.safeParse({ ...valid, name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects a negative fee', () => {
    const result = documentTypeSchema.safeParse({ ...valid, feeCentavos: -100 });
    expect(result.success).toBe(false);
  });

  it('rejects a processingTargetHours below 1', () => {
    const result = documentTypeSchema.safeParse({ ...valid, processingTargetHours: 0 });
    expect(result.success).toBe(false);
  });
});
