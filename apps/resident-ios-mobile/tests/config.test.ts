import { spawnSync } from 'node:child_process';
import path from 'node:path';
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

describe('release diagnostic (scripts/check-release.cjs)', () => {
  const workspace = path.resolve(__dirname, '..');
  const valid = {
    IOS_BUNDLE_IDENTIFIER: 'ph.barangayan.resident', IOS_URL_SCHEME: 'barangayan-resident', EAS_PROJECT_ID: 'project',
    EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test',
    EXPO_PUBLIC_BARANGAY_ID: 'a0000000-0000-4000-8000-000000000001', EXPO_PUBLIC_ENVIRONMENT: 'production',
  };
  const run = (overrides: Record<string, string>) => {
    // A clean environment: nothing from the developer's shell (such as a real EXPO_PUBLIC_* value) can change the outcome.
    const env: NodeJS.ProcessEnv = { PATH: process.env.PATH ?? '', NODE_ENV: 'test', ...valid, ...overrides };
    const result = spawnSync(process.execPath, ['scripts/check-release.cjs'], { cwd: workspace, env, encoding: 'utf8' });
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  };
  it('fails when a variable is missing', () => {
    const result = run({ EAS_PROJECT_ID: '' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('Missing release configuration: EAS_PROJECT_ID');
  });
  it('rejects placeholder identifiers and a non-production environment', () => {
    const result = run({ IOS_BUNDLE_IDENTIFIER: 'com.placeholder.appid', IOS_URL_SCHEME: 'com.placeholder.appid', EXPO_PUBLIC_ENVIRONMENT: 'staging' });
    expect(result.status).toBe(1);
    expect(result.output).toContain('IOS_BUNDLE_IDENTIFIER must be the approved reverse-DNS App ID');
    expect(result.output).toContain('IOS_URL_SCHEME must be the approved lower-case scheme');
    expect(result.output).toContain('EXPO_PUBLIC_ENVIRONMENT must be "production"');
  });
  it('does not flag valid values, and still reports every closed gate', () => {
    const result = run({});
    expect(result.status).toBe(1);
    expect(result.output).not.toContain('Invalid release configuration');
    expect(result.output).not.toContain('Missing release configuration');
    for (const gate of Object.entries(releaseGates).filter(([, open]) => !open).map(([name]) => name)) expect(result.output).toContain(gate);
  });
});
