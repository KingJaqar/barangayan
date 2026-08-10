import { describe, expect, it } from 'vitest';

import { staffSchema, staffInviteSchema } from './staff';

describe('staffSchema', () => {
  it('parses a valid staff update', () => {
    const result = staffSchema.safeParse({
      full_name: 'Juan Dela Cruz',
      role: 'staff',
      mobile_number: '+639171234567',
      home_address: 'Purok 1, Barangay Ampid I',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing full_name', () => {
    const result = staffSchema.safeParse({
      full_name: '',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid role', () => {
    const result = staffSchema.safeParse({
      full_name: 'Test',
      role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields as empty strings', () => {
    const result = staffSchema.safeParse({
      full_name: 'Test User',
      role: 'staff',
      mobile_number: '',
      home_address: '',
    });
    expect(result.success).toBe(true);
  });
});

describe('staffInviteSchema', () => {
  it('parses a valid invite payload', () => {
    const result = staffInviteSchema.safeParse({
      email: 'new.staff@barangay.gov.ph',
      full_name: 'New Staff Member',
      role: 'staff',
      mobile_number: '+639170000000',
      home_address: 'Purok 4, Barangay Ampid I',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = staffInviteSchema.safeParse({
      email: 'not-an-email',
      full_name: 'Test',
      role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email', () => {
    const result = staffInviteSchema.safeParse({
      email: '',
      full_name: 'Test',
      role: 'staff',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing full_name', () => {
    const result = staffInviteSchema.safeParse({
      email: 'test@barangay.gov.ph',
      full_name: '',
      role: 'staff',
    });
    expect(result.success).toBe(false);
  });
});
