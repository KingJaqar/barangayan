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
});
