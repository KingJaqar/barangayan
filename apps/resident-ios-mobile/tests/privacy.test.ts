import { describe, expect, it } from 'vitest';
import { clearAppleAuthorizationCode, holdAppleAuthorizationCode, takeAppleAuthorizationCode } from '../src/auth/apple-authorization';
import type { SetupStatus } from '../src/auth/setup-status';
import { DELETE_CONTRACT_VERSION, runDelete } from '../src/features/privacy/delete-run';
import { hasAnyProof, proofMethods } from '../src/features/privacy/delete-proof';
import { EXPORT_SECTIONS, validateExport } from '../src/features/privacy/export-contract';
import { displayValue, exportFileName, exportHtml, exportJson } from '../src/features/privacy/export-files';
import { runExport, type ExportDeps } from '../src/features/privacy/export-run';
import type { FunctionReply } from '../src/features/privacy/function-call';
import { emptyListing } from '../src/lib/private-files-core';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';
const section = (rows: Record<string, unknown>[] = []) => ({ status: 'complete', label: 'x', rowCount: rows.length, truncated: false, rows });
function payload(overrides: Record<string, unknown> = {}, account = ACCOUNT) {
  const sections: Record<string, unknown> = Object.fromEntries(EXPORT_SECTIONS.map((entry) => [entry.name, section()]));
  sections.profile = section([{ id: ACCOUNT, full_name: 'Maria Santos', birth_date: '1990-02-01' }]);
  return { contractVersion: 2, exportedAt: '2026-10-21T04:00:00.000Z', account: { id: account, email: 'maria@example.com' }, sections: { ...sections, ...overrides } };
}

describe('export contract v2 (A45)', () => {
  it('accepts a complete export for this account and keeps the required order', () => {
    const result = validateExport(payload(), ACCOUNT);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.sections.map((entry) => entry.name)).toEqual(EXPORT_SECTIONS.map((entry) => entry.name));
  });

  it('refuses a payload that is not the v2 envelope', () => {
    expect(validateExport({ exported_at: 'x', profile: {} }, ACCOUNT)).toEqual({ ok: false, reason: 'format', sections: [] });
    expect(validateExport(null, ACCOUNT)).toMatchObject({ ok: false, reason: 'format' });
    expect(validateExport({ ...payload(), contractVersion: 3 }, ACCOUNT)).toMatchObject({ ok: false, reason: 'format' });
  });

  it('refuses an export of another account', () => {
    expect(validateExport(payload({}, '22222222-2222-4222-8222-222222222222'), ACCOUNT)).toMatchObject({ ok: false, reason: 'wrong-account' });
  });

  it('names every required section that is missing, failed, truncated or inconsistent', () => {
    const result = validateExport(payload({
      payments: { status: 'failed', label: 'Payments', rowCount: 0, truncated: false, error: 'x' },
      incident_reports: { ...section([{ id: 'a' }]), truncated: true },
      notification_inbox: { ...section([{ id: 'a' }]), rowCount: 2 },
    }), ACCOUNT);
    expect(result).toEqual({ ok: false, reason: 'incomplete', sections: ['Payments', 'Incident reports', 'Notification inbox'] });
    const missing = payload();
    delete (missing.sections as Record<string, unknown>).registered_devices;
    expect(validateExport(missing, ACCOUNT)).toEqual({ ok: false, reason: 'incomplete', sections: ['Registered devices'] });
  });

  it('does not accept an empty list in place of a failed section', () => {
    const failed = { status: 'failed', label: 'Service requests', rowCount: 0, truncated: false, error: 'read' };
    expect(validateExport(payload({ service_requests: failed }), ACCOUNT)).toMatchObject({ ok: false, sections: ['Service requests'] });
  });

  it('requires exactly one profile row', () => {
    expect(validateExport(payload({ profile: section() }), ACCOUNT)).toEqual({ ok: false, reason: 'incomplete', sections: ['Profile'] });
  });
});

describe('export files', () => {
  const valid = () => {
    const result = validateExport(payload({
      service_requests: section([{ reference_number: 'REQ-1', assessed_amount_centavos: 15050, requester_notes: '<b>hi</b> & bye', created_at: '2026-10-20T01:00:00.000Z', document_types: { name: 'Barangay Clearance' }, status_history: [{ status: 'submitted', at: '2026-10-20T01:00:00.000Z', note: null }] }]),
    }), ACCOUNT);
    if (!result.ok) throw new Error('fixture');
    return result.value;
  };

  it('names files by the export date and format', () => {
    expect(exportFileName('2026-10-21T04:00:00.000Z', 'pdf')).toMatch(/^Barangayan-my-data-2026-10-2\d\.pdf$/);
    expect(exportFileName('2026-10-21T04:00:00.000Z', 'json')).toMatch(/\.json$/);
  });

  it('writes JSON with every section and its row count', () => {
    const parsed = JSON.parse(exportJson(valid()));
    expect(Object.keys(parsed.sections)).toEqual(EXPORT_SECTIONS.map((entry) => entry.name));
    expect(parsed.sections.service_requests.rowCount).toBe(1);
    expect(parsed.account.id).toBe(ACCOUNT);
  });

  it('prints every section, says when one is empty, escapes values and formats money and dates', () => {
    const html = exportHtml(valid(), new Date('2026-10-21T04:00:00Z'));
    for (const entry of EXPORT_SECTIONS) expect(html).toContain(entry.label);
    expect(html).toContain('No records.');
    expect(html).toContain('&lt;b&gt;hi&lt;/b&gt; &amp; bye');
    expect(html).not.toContain('<b>hi</b>');
    expect(html).toContain('₱150.50');
    expect(html).toContain('Barangay Clearance');
    expect(html).not.toMatch(/https?:\/\//);
  });

  it('shows a calendar date without shifting it by time zone, and unknown values without dropping them', () => {
    expect(displayValue('birth_date', '1990-02-01')).toMatch(/Feb(ruary)? 1, 1990/);
    expect(displayValue('flag', true)).toBe('Yes');
    expect(displayValue('x', null)).toBe('—');
    expect(displayValue('x', [])).toBe('—');
    expect(displayValue('x', { a: 1 })).toBe('{"a":1}');
    expect(displayValue('amount_centavos', 0)).toBe('₱0.00');
  });
});

function deps(reply: FunctionReply, extras: Partial<ExportDeps> = {}) {
  const log: string[] = [];
  const base: ExportDeps = {
    request: async () => reply,
    writeJson: (name) => { log.push(`write ${name}`); return { uri: `file:///${name}`, remove: () => { log.push('remove'); } }; },
    renderPdf: async (name) => { log.push(`pdf ${name}`); return { uri: `file:///${name}`, remove: () => { log.push('remove'); } }; },
    canShare: async () => true,
    share: async (uri) => { log.push(`share ${uri}`); },
    now: () => new Date('2026-10-21T04:00:00Z'),
  };
  return { deps: { ...base, ...extras }, log };
}

describe('running an export', () => {
  it('shares a complete JSON export and removes the temporary file afterwards', async () => {
    const { deps: d, log } = deps({ kind: 'ok', data: payload() });
    const outcome = await runExport(d, 'json', ACCOUNT);
    expect(outcome.status).toBe('shared');
    expect(outcome.message).not.toMatch(/saved\./i);
    expect(log.map((line) => line.split(' ')[0])).toEqual(['write', 'share', 'remove']);
  });

  it('renders a PDF, shares it and removes it', async () => {
    const { deps: d, log } = deps({ kind: 'ok', data: payload() });
    expect((await runExport(d, 'pdf', ACCOUNT)).status).toBe('shared');
    expect(log.map((line) => line.split(' ')[0])).toEqual(['pdf', 'share', 'remove']);
  });

  it('creates no file for an incomplete payload, a failed server read or another account', async () => {
    for (const reply of [
      { kind: 'ok', data: payload({ payments: { status: 'failed', label: 'Payments', rowCount: 0, truncated: false, error: 'x' } }) },
      { kind: 'http', status: 502, body: { error: 'x', failedSections: ['payments'] }, retryAfterSeconds: null },
      { kind: 'ok', data: payload({}, '22222222-2222-4222-8222-222222222222') },
    ] as FunctionReply[]) {
      const { deps: d, log } = deps(reply);
      const outcome = await runExport(d, 'json', ACCOUNT);
      expect(['incomplete', 'failed']).toContain(outcome.status);
      expect(log).toEqual([]);
    }
  });

  it('turns the server cooldown into a wait, a lost session into a prompt and a lost network into a retry', async () => {
    const cooldown = await runExport(deps({ kind: 'http', status: 429, body: { error: 'wait' }, retryAfterSeconds: 42 }).deps, 'json', ACCOUNT);
    expect(cooldown).toMatchObject({ status: 'cooldown', retryAfterSeconds: 42 });
    const noHeader = await runExport(deps({ kind: 'http', status: 429, body: null, retryAfterSeconds: null }).deps, 'json', ACCOUNT);
    expect(noHeader).toMatchObject({ status: 'cooldown', retryAfterSeconds: 60 });
    expect((await runExport(deps({ kind: 'http', status: 401, body: null, retryAfterSeconds: null }).deps, 'json', ACCOUNT)).status).toBe('session');
    const offline = await runExport(deps({ kind: 'unreachable' }).deps, 'json', ACCOUNT);
    expect(offline.status).toBe('failed');
    expect(offline.message).toMatch(/Nothing was shared/);
  });

  it('removes the file and reports failure when sharing throws or is unavailable', async () => {
    const thrown = deps({ kind: 'ok', data: payload() }, { share: async () => { throw new Error('cancelled by system'); } });
    expect((await runExport(thrown.deps, 'json', ACCOUNT)).status).toBe('failed');
    expect(thrown.log.at(-1)).toBe('remove');
    const unavailable = deps({ kind: 'ok', data: payload() }, { canShare: async () => false });
    expect((await runExport(unavailable.deps, 'pdf', ACCOUNT)).status).toBe('unavailable');
    expect(unavailable.log.at(-1)).toBe('remove');
  });

  it('removes the file when rendering the PDF fails midway', async () => {
    const failing = deps({ kind: 'ok', data: payload() }, { renderPdf: async () => { throw new Error('print'); } });
    expect((await runExport(failing.deps, 'pdf', ACCOUNT)).status).toBe('failed');
  });
});

describe('deleting the account (A46)', () => {
  it('reports success only for the completed state', async () => {
    const done = await runDelete(async () => ({ kind: 'ok', data: { contractVersion: DELETE_CONTRACT_VERSION, state: 'completed' } }));
    expect(done.status).toBe('completed');
    for (const state of ['requested', 'profile_erased', 'storage_cleaned', 'auth_revoked', 'needs_attention']) {
      expect((await runDelete(async () => ({ kind: 'ok', data: { contractVersion: DELETE_CONTRACT_VERSION, state } }))).status, state).toBe('partial');
    }
  });

  it('never treats an unexpected answer as success', async () => {
    for (const data of [{ success: true }, { contractVersion: 2, state: 'done' }, null, 'ok']) {
      expect((await runDelete(async () => ({ kind: 'ok', data }))).status).toBe('unknown');
    }
  });

  it('asks for a fresh confirmation, and says what a lost reply means', async () => {
    const stale = await runDelete(async () => ({ kind: 'http', status: 401, body: { error: 'fresh_authentication_required' }, retryAfterSeconds: null }));
    expect(stale.status).toBe('reauthenticate');
    const apple = await runDelete(async () => ({ kind: 'http', status: 400, body: { error: 'apple_authorization_required' }, retryAfterSeconds: null }));
    expect(apple.status).toBe('reauthenticate');
    const lost = await runDelete(async () => ({ kind: 'unreachable' }));
    expect(lost.status).toBe('unknown');
    expect(lost.message).toMatch(/Do not assume/);
    const ended = await runDelete(async () => ({ kind: 'http', status: 401, body: { error: 'Not authenticated' }, retryAfterSeconds: null }));
    expect(ended.status).toBe('session-ended');
  });

  it('reports unavailable Apple revocation, a missing function and a partial server stop honestly', async () => {
    expect((await runDelete(async () => ({ kind: 'http', status: 503, body: { error: 'apple_revocation_unavailable' }, retryAfterSeconds: null }))).status).toBe('unavailable');
    expect((await runDelete(async () => ({ kind: 'http', status: 404, body: null, retryAfterSeconds: null }))).status).toBe('unavailable');
    expect((await runDelete(async () => ({ kind: 'http', status: 502, body: { error: 'x' }, retryAfterSeconds: null }))).status).toBe('partial');
    expect((await runDelete(async () => ({ kind: 'http', status: 500, body: { error: 'boom' }, retryAfterSeconds: null }))).status).toBe('failed');
  });
});

const status = (overrides: Partial<SetupStatus>): SetupStatus => ({
  contractVersion: 2, registrationOrigin: 'email_otp', profileComplete: true, passwordSet: true, identityProviders: [], hasGoogleIdentity: false, hasAppleIdentity: false, emailIsPrivateRelay: false, ...overrides,
});

describe('proof for deletion', () => {
  it('uses the password for a password account and a provider for a provider-only account', () => {
    expect(proofMethods(status({}))).toEqual({ password: true, google: false, apple: false });
    expect(proofMethods(status({ passwordSet: false, hasGoogleIdentity: true }))).toEqual({ password: false, google: true, apple: false });
    expect(proofMethods(status({ passwordSet: null }))).toMatchObject({ password: true });
  });

  it('requires Apple for an Apple-linked account so its sign-in is disconnected', () => {
    expect(proofMethods(status({ hasAppleIdentity: true, hasGoogleIdentity: true }))).toEqual({ password: false, google: false, apple: true });
  });

  it('has no way to prove identity for an account with no password and no provider', () => {
    expect(hasAnyProof(proofMethods(status({ passwordSet: false })))).toBe(false);
  });
});

describe('Apple authorization code for deletion', () => {
  it('is single use, tied to one user and short lived', () => {
    holdAppleAuthorizationCode('user-a', 'code-1', 1000);
    expect(takeAppleAuthorizationCode('user-b', 1500)).toBeNull();
    holdAppleAuthorizationCode('user-a', 'code-1', 1000);
    expect(takeAppleAuthorizationCode('user-a', 1500)).toBe('code-1');
    expect(takeAppleAuthorizationCode('user-a', 1600)).toBeNull();
    holdAppleAuthorizationCode('user-a', 'code-2', 1000);
    expect(takeAppleAuthorizationCode('user-a', 1000 + 6 * 60_000)).toBeNull();
    holdAppleAuthorizationCode('user-a', 'code-3', 1000);
    clearAppleAuthorizationCode();
    expect(takeAppleAuthorizationCode('user-a', 1100)).toBeNull();
  });
});

describe('private temporary files', () => {
  const entry = (fails = false) => ({ removed: false, delete() { if (fails) throw new Error('busy'); this.removed = true; } });

  it('removes every entry and counts the ones it could not remove', () => {
    const entries = [entry(), entry(true), entry()];
    expect(emptyListing({ exists: true, list: () => entries })).toBe(1);
    expect(entries.map((item) => item.removed)).toEqual([true, false, true]);
  });

  it('treats a missing folder as clean and an unreadable one as a failure', () => {
    expect(emptyListing({ exists: false, list: () => { throw new Error('no'); } })).toBe(0);
    expect(emptyListing({ exists: true, list: () => { throw new Error('denied'); } })).toBe(1);
  });
});
