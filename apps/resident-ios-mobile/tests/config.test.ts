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
  // Owner decisions opened exactly these gates: OD-09 (2026-10-16) qrph and pickup, OD-10 (2026-10-16) emergencyContent, OD-11 (2026-10-16) routeService, OD-12 (2026-10-16) evacuationCheckin and householdQr, OD-13 (2026-10-16) medicalRegistration; every other gate stays closed until its evidence exists.
  const OPENED_BY_OWNER = ['qrph', 'pickup', 'emergencyContent', 'routeService', 'evacuationCheckin', 'householdQr', 'medicalRegistration'];
  it('keeps all unverified release-dependent actions closed', () => {
    for (const gate of Object.keys(releaseGates) as (keyof typeof releaseGates)[]) {
      if (OPENED_BY_OWNER.includes(gate)) continue;
      expect(() => requireGate(gate)).toThrow();
    }
  });
  it('opens only the gates the owner decided to open', () => {
    expect(Object.entries(releaseGates).filter(([, open]) => open).map(([gate]) => gate).sort()).toEqual(OPENED_BY_OWNER.slice().sort());
    for (const gate of OPENED_BY_OWNER) expect(() => requireGate(gate as keyof typeof releaseGates)).not.toThrow();
  });
});
