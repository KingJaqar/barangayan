import { describe, expect, it } from 'vitest';

import { announcementSchema } from './announcement';

describe('announcementSchema', () => {
  it('parses a valid announcement', () => {
    const result = announcementSchema.safeParse({
      title: 'Road Closure Notice',
      body: 'Main street will be closed for repairs.',
      category: 'general',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing title', () => {
    const result = announcementSchema.safeParse({
      title: '',
      body: 'Body text',
      category: 'general',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing body', () => {
    const result = announcementSchema.safeParse({
      title: 'Title',
      body: '',
      category: 'general',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid category', () => {
    const result = announcementSchema.safeParse({
      title: 'Title',
      body: 'Body',
      category: 'not-a-real-category',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid image_url', () => {
    const result = announcementSchema.safeParse({
      title: 'Title',
      body: 'Body',
      category: 'general',
      image_url: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });

  it('accepts an empty string image_url', () => {
    const result = announcementSchema.safeParse({
      title: 'Title',
      body: 'Body',
      category: 'general',
      image_url: '',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a missing detailed_description', () => {
    const result = announcementSchema.safeParse({
      title: 'Title',
      body: 'Body',
      category: 'general',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid detailed_description', () => {
    const result = announcementSchema.safeParse({
      title: 'Title',
      body: 'Body',
      category: 'general',
      detailed_description: 'A much longer write-up with the full context residents need.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a detailed_description over 5000 characters', () => {
    const result = announcementSchema.safeParse({
      title: 'Title',
      body: 'Body',
      category: 'general',
      detailed_description: 'a'.repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  const advisory = { title: 'Advisory', body: 'Recorded guidance', category: 'emergency', published_at: '2026-10-28T00:00:00Z' };
  it.each([
    [undefined, true], [null, true], ['2026-10-28T01:00:00Z', true],
    ['2026-10-28T00:00:00Z', false], ['2026-10-27T23:59:59Z', false],
    ['infinity', false], ['-infinity', false], ['not-a-date', false], ['', false],
  ])('validates expiry %s (accepted %s)', (alert_expires_at, accepted) => {
    expect(announcementSchema.safeParse({ ...advisory, alert_expires_at }).success).toBe(accepted);
  });
  it('accepts historical expired advisories after their recorded publication', () => {
    expect(announcementSchema.safeParse({ ...advisory, published_at: '2020-01-01T00:00:00Z', alert_expires_at: '2020-01-02T00:00:00Z' }).success).toBe(true);
  });
  it('accepts PostgREST offsets and compares absolute instants across timezones', () => {
    expect(announcementSchema.safeParse({ ...advisory, published_at: '2026-10-28T04:00:00+00:00', alert_expires_at: '2026-10-28T13:00:00+08:00' }).success).toBe(true);
    expect(announcementSchema.safeParse({ ...advisory, published_at: '2026-10-28T04:00:00+00:00', alert_expires_at: '2026-10-28T11:59:59+08:00' }).success).toBe(false);
  });
  it('requires emergency category and explicit effective publication when expiry is set', () => {
    expect(announcementSchema.safeParse({ ...advisory, category: 'general', alert_expires_at: '2026-10-29T00:00:00Z' }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...advisory, published_at: undefined, alert_expires_at: '2026-10-29T00:00:00Z' }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...advisory, category: 'health', alert_expires_at: null }).success).toBe(true);
  });
});
