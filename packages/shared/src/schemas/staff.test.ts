import { describe, expect, it } from 'vitest';

import { staffSchema, staffInviteSchema } from './staff';

describe('staffSchema', () => {
  it('parses a valid staff update', () => {
    const result = staffSchema.safeParse({
      full_name: 'Juan Dela Cruz',
      official_role: 'staff',
      mobile_number: '+639171234567',
      home_address: 'Purok 1, Barangay Ampid I',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a missing full_name', () => {
    const result = staffSchema.safeParse({
      full_name: '',
      official_role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid official_role', () => {
    const result = staffSchema.safeParse({
      full_name: 'Test',
      official_role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });

  it('accepts a barangay job role', () => {
    const result = staffSchema.safeParse({
      full_name: 'Test User',
      official_role: 'kagawad',
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
      official_role: 'staff',
      mobile_number: '+639170000000',
      home_address: 'Purok 4, Barangay Ampid I',
    });
    expect(result.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const result = staffInviteSchema.safeParse({
      email: 'not-an-email',
      full_name: 'Test',
      official_role: 'admin',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing email', () => {
    const result = staffInviteSchema.safeParse({
      email: '',
      full_name: 'Test',
      official_role: 'staff',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a missing full_name', () => {
    const result = staffInviteSchema.safeParse({
      email: 'test@barangay.gov.ph',
      full_name: '',
      official_role: 'staff',
    });
    expect(result.success).toBe(false);
  });

  it('rejects an invalid official_role', () => {
    const result = staffInviteSchema.safeParse({
      email: 'test@barangay.gov.ph',
      full_name: 'Test',
      official_role: 'superadmin',
    });
    expect(result.success).toBe(false);
  });
});
