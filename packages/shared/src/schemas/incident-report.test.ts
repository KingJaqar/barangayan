import { describe, expect, it } from 'vitest';

import { incidentConfirmationSchema, incidentReportSchema } from './incident-report';

describe('incidentReportSchema', () => {
  const valid = {
    categoryId: '11111111-1111-1111-1111-111111111111',
    description: 'Illegal dumping near the corner store.',
    photoUrls: ['https://example.com/photo.jpg'],
    location: { lat: 14.7, lng: 121.1 },
  };

  it('parses a valid incident report', () => {
    expect(incidentReportSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an empty description', () => {
    const result = incidentReportSchema.safeParse({ ...valid, description: '' });
    expect(result.success).toBe(false);
  });

  it('rejects zero photoUrls', () => {
    const result = incidentReportSchema.safeParse({ ...valid, photoUrls: [] });
    expect(result.success).toBe(false);
  });

  it('rejects more than 5 photoUrls', () => {
    const result = incidentReportSchema.safeParse({
      ...valid,
      photoUrls: Array.from({ length: 6 }, (_, i) => `https://example.com/${i}.jpg`),
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range latitude', () => {
    const result = incidentReportSchema.safeParse({ ...valid, location: { lat: 91, lng: 0 } });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range longitude', () => {
    const result = incidentReportSchema.safeParse({ ...valid, location: { lat: 0, lng: 181 } });
    expect(result.success).toBe(false);
  });
});

describe('incidentConfirmationSchema', () => {
  it('parses a valid confirmation', () => {
    const result = incidentConfirmationSchema.safeParse({
      incidentId: '11111111-1111-1111-1111-111111111111',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid incidentId', () => {
    const result = incidentConfirmationSchema.safeParse({ incidentId: 'nope' });
    expect(result.success).toBe(false);
  });
});
