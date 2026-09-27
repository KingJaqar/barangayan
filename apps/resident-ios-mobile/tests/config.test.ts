import { describe, expect, it } from 'vitest';
import { configurationSchema } from '../src/lib/config';
import { requireGate, releaseGates } from '../src/lib/release-gates';

describe('configuration and launch gates', () => {
  const base = { url: 'https://example.supabase.co', anonKey: 'sb_publishable_test', barangayId: 'a0000000-0000-4000-8000-000000000001', environment: 'staging' };
  it('requires an explicit valid tenant and HTTPS endpoint', () => {
    expect(configurationSchema.safeParse(base).success).toBe(true);
    expect(configurationSchema.safeParse({ ...base, barangayId: '' }).success).toBe(false);
    expect(configurationSchema.safeParse({ ...base, url: 'http://example.com' }).success).toBe(false);
  });
  it('rejects privileged keys', () => {
    const key = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
    expect(configurationSchema.safeParse({ ...base, anonKey: key }).success).toBe(false);
    expect(configurationSchema.safeParse({ ...base, anonKey: 'sb_secret_no' }).success).toBe(false);
  });
  it('keeps all unverified release-dependent actions closed', () => {
    for (const gate of Object.keys(releaseGates) as (keyof typeof releaseGates)[]) expect(() => requireGate(gate)).toThrow();
  });
});
