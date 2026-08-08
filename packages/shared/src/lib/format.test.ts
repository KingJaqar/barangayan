import { describe, expect, it } from 'vitest';

import {
  estimateLabel,
  formatCentavosAsPHP,
  formatDate,
  formatDateTime,
  formatDriveRegistrationNumber,
  formatProcessingTime,
  progressFraction,
} from './format';

describe('formatCentavosAsPHP', () => {
  it('formats 1000 centavos as ₱10.00', () => {
    expect(formatCentavosAsPHP(1000)).toBe('₱10.00');
  });

  it('formats 0 centavos as ₱0.00', () => {
    expect(formatCentavosAsPHP(0)).toBe('₱0.00');
  });

  it('formats a large amount with thousands separators', () => {
    expect(formatCentavosAsPHP(123456789)).toBe('₱1,234,567.89');
  });
});

describe('formatDriveRegistrationNumber', () => {
  it('zero-pads to 3 digits', () => {
    expect(formatDriveRegistrationNumber(7)).toBe('#VAC-007');
  });

  it('does not truncate numbers over 999', () => {
    expect(formatDriveRegistrationNumber(1234)).toBe('#VAC-1234');
  });
});

describe('formatDateTime / formatDate', () => {
  it('formats an ISO string without throwing', () => {
    expect(() => formatDateTime('2026-08-07T10:30:00Z')).not.toThrow();
    expect(() => formatDate('2026-08-07T10:30:00Z')).not.toThrow();
  });

  it('formatDate omits a time component', () => {
    const formatted = formatDate('2026-08-07T10:30:00Z');
    expect(formatted).not.toMatch(/\d{1,2}:\d{2}/);
  });
});

describe('formatProcessingTime', () => {
  it('buckets same-day for <= 24 hours', () => {
    expect(formatProcessingTime(24)).toBe('Same Day');
  });

  it('buckets 1-2 working days for <= 48 hours', () => {
    expect(formatProcessingTime(48)).toBe('1-2 Working Days');
  });

  it('buckets 3-5 working days for <= 120 hours', () => {
    expect(formatProcessingTime(120)).toBe('3-5 Working Days');
  });

  it('falls back to a computed day count beyond 120 hours', () => {
    expect(formatProcessingTime(240)).toBe('10 Working Days');
  });
});

describe('progressFraction', () => {
  it('returns 1 for a completed request regardless of elapsed time', () => {
    const longAgo = new Date(Date.now() - 1000 * 3600 * 1000).toISOString();
    expect(progressFraction('completed', longAgo, 24)).toBe(1);
  });

  it('never returns more than 0.95 for a non-completed request', () => {
    const longAgo = new Date(Date.now() - 1000 * 3600 * 1000).toISOString();
    expect(progressFraction('in_progress', longAgo, 24)).toBeLessThanOrEqual(0.95);
  });

  it('applies the floor for a freshly submitted request', () => {
    const now = new Date().toISOString();
    expect(progressFraction('submitted', now, 24)).toBeGreaterThanOrEqual(0.08);
  });
});

describe('estimateLabel', () => {
  it('reads "any moment" once the target has passed', () => {
    const longAgo = new Date(Date.now() - 1000 * 3600 * 1000).toISOString();
    expect(estimateLabel(longAgo, 24)).toBe('Est. any moment');
  });

  it('reads in hours when under a day remains', () => {
    const recent = new Date(Date.now() - 1000 * 60 * 60).toISOString(); // 1h ago
    expect(estimateLabel(recent, 24)).toMatch(/^Est\. \d+ hours?$/);
  });

  it('reads in days when more than a day remains', () => {
    const now = new Date().toISOString();
    expect(estimateLabel(now, 96)).toMatch(/^Est\. \d+ days?$/);
  });
});
