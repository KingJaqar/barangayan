import { describe, expect, it } from 'vitest';

import { computeDocumentTypeTrends, getCompletionHours, getSlaFlag } from './service-tracking';

describe('getSlaFlag', () => {
  const now = new Date('2026-01-10T00:00:00Z');

  it('returns on_track well before the target', () => {
    const createdAt = new Date('2026-01-09T12:00:00Z').toISOString(); // 12h elapsed, target 24h
    expect(getSlaFlag(createdAt, 24, now)).toBe('on_track');
  });

  it('returns near_target at 80%+ of the target', () => {
    const createdAt = new Date('2026-01-09T05:00:00Z').toISOString(); // 19h elapsed, target 24h (79.2%) -> on_track
    expect(getSlaFlag(createdAt, 24, now)).toBe('on_track');
    const createdAt2 = new Date('2026-01-09T04:00:00Z').toISOString(); // 20h elapsed (83%) -> near_target
    expect(getSlaFlag(createdAt2, 24, now)).toBe('near_target');
  });

  it('returns overdue once elapsed time reaches the target', () => {
    const createdAt = new Date('2026-01-08T00:00:00Z').toISOString(); // 48h elapsed, target 24h
    expect(getSlaFlag(createdAt, 24, now)).toBe('overdue');
  });
});

describe('getCompletionHours', () => {
  it('computes hours between created_at and the completed status_history entry', () => {
    const createdAt = '2026-01-01T00:00:00Z';
    const history = [
      { status: 'submitted', at: '2026-01-01T00:00:00Z' },
      { status: 'in_progress', at: '2026-01-01T12:00:00Z' },
      { status: 'completed', at: '2026-01-02T00:00:00Z' },
    ];
    expect(getCompletionHours(createdAt, history)).toBe(24);
  });

  it('returns null when there is no completed entry', () => {
    const history = [{ status: 'submitted', at: '2026-01-01T00:00:00Z' }];
    expect(getCompletionHours('2026-01-01T00:00:00Z', history)).toBeNull();
  });

  it('returns null for malformed status_history', () => {
    expect(getCompletionHours('2026-01-01T00:00:00Z', null)).toBeNull();
    expect(getCompletionHours('2026-01-01T00:00:00Z', 'not-an-array')).toBeNull();
  });
});

describe('computeDocumentTypeTrends', () => {
  it('averages completion hours per document type', () => {
    const documentTypes = [{ id: 'doc-1', name: 'Barangay Clearance', processing_target_hours: 24 }];
    const requests = [
      {
        document_type_id: 'doc-1',
        created_at: '2026-01-01T00:00:00Z',
        status_history: [{ status: 'completed', at: '2026-01-02T00:00:00Z' }], // 24h
      },
      {
        document_type_id: 'doc-1',
        created_at: '2026-01-01T00:00:00Z',
        status_history: [{ status: 'completed', at: '2026-01-01T12:00:00Z' }], // 12h
      },
    ];
    const trends = computeDocumentTypeTrends(requests, documentTypes);
    expect(trends).toHaveLength(1);
    expect(trends[0]!.averageHours).toBe(18);
    expect(trends[0]!.completedCount).toBe(2);
  });

  it('reports null average for a document type with no completions yet', () => {
    const documentTypes = [{ id: 'doc-2', name: 'Indigency Certificate', processing_target_hours: 12 }];
    const trends = computeDocumentTypeTrends([], documentTypes);
    expect(trends[0]!.averageHours).toBeNull();
    expect(trends[0]!.completedCount).toBe(0);
  });
});
