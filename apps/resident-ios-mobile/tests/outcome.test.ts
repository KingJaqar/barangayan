import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { checkWrite, containsPattern, parseCount, parseMaybeRow, parseRow, parseRows, quoteFilterValue } from '../src/data/boundary';
import { createSingleFlight } from '../src/data/mutation';
import { classifyFailure, DataError } from '../src/data/outcome';
import { PublicError, residentError } from '../src/lib/errors';

const row = z.object({ id: z.string().uuid(), name: z.string() });
const ID = '11111111-1111-4111-8111-111111111111';
// postgrest-js shapes (verified in node_modules/@supabase/postgrest-js): transport failures resolve with status 0.
const offline = { data: null, error: { message: 'TypeError: Network request failed', details: '', hint: '', code: '' }, status: 0 };
const aborted = { data: null, error: { message: 'AbortError: Aborted', details: '', hint: 'Request was aborted (timeout or manual cancellation)', code: '' }, status: 0 };

describe('failure classification (P02-T01)', () => {
  it('separates network, timeout, HTTP, authorization, session and validation outcomes', () => {
    expect(classifyFailure(offline.error, { status: 0 })).toBe('offline');
    expect(classifyFailure(aborted.error, { status: 0 })).toBe('timeout');
    expect(classifyFailure({ code: '42501', message: 'denied' }, { status: 403 })).toBe('authorization');
    expect(classifyFailure({ code: 'PGRST301' }, { status: 401 })).toBe('session');
    expect(classifyFailure({ code: '22P02' }, { status: 400 })).toBe('validation');
    expect(classifyFailure({ code: '23505' }, { status: 409 })).toBe('conflict');
    expect(classifyFailure({ message: 'boom' }, { status: 503 })).toBe('http');
    expect(classifyFailure(new z.ZodError([]))).toBe('validation');
    // storage-js shapes: StorageApiError carries a numeric status; network failures are StorageUnknownError.
    expect(classifyFailure({ name: 'StorageApiError', status: 403, statusCode: '403', message: 'new row violates row-level security' })).toBe('authorization');
    expect(classifyFailure({ name: 'StorageUnknownError', message: 'Network request failed' })).toBe('offline');
  });
  it('treats transport and 5xx failures of a write as an unknown commit, never as a definite failure', () => {
    expect(classifyFailure(offline.error, { status: 0, write: true })).toBe('unknown-commit');
    expect(classifyFailure(aborted.error, { status: 0, write: true })).toBe('unknown-commit');
    expect(classifyFailure({ message: 'gateway' }, { status: 502, write: true })).toBe('unknown-commit');
    expect(classifyFailure({ code: '42501' }, { status: 403, write: true })).toBe('authorization');
  });
  it('reports caller cancellation as cancelled even when the transport says aborted', () => {
    const controller = new AbortController();
    controller.abort();
    expect(classifyFailure(aborted.error, { status: 0, signal: controller.signal })).toBe('cancelled');
  });
});

describe('response boundary (P02-T01)', () => {
  it('distinguishes valid empty data, absent records, schema drift and HTTP errors', () => {
    expect(parseRows(row, { data: [], error: null, status: 200 })).toEqual([]);
    expect(parseMaybeRow(row, { data: null, error: null, status: 200 })).toBeNull();
    expect(() => parseRow(row, { data: null, error: null, status: 200 })).toThrow(expect.objectContaining({ kind: 'not-found' }));
    expect(() => parseRows(row, { data: [{ id: ID, name: null }], error: null, status: 200 })).toThrow(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseRows(row, { data: { id: ID }, error: null, status: 200 })).toThrow(expect.objectContaining({ kind: 'schema' }));
    expect(() => parseRows(row, offline)).toThrow(expect.objectContaining({ kind: 'offline' }));
  });
  it('strips unknown fields and never copies the raw payload into the error', () => {
    expect(parseRows(row, { data: [{ id: ID, name: 'A', secret: 'x' }], error: null })).toEqual([{ id: ID, name: 'A' }]);
    try { parseRows(row, { data: [{ id: 'not-a-uuid', name: 'Juan Dela Cruz' }], error: null }); } catch (error) {
      expect(String((error as Error).message)).not.toContain('Juan');
    }
  });
  it('requires a real count and never substitutes zero', () => {
    expect(parseCount({ data: null, error: null, count: 4 })).toBe(4);
    expect(() => parseCount({ data: null, error: null, count: null })).toThrow(expect.objectContaining({ kind: 'schema' }));
  });
  it('drops a reply that arrives after the caller cancelled', () => {
    const controller = new AbortController();
    controller.abort();
    expect(() => parseRows(row, { data: [], error: null }, controller.signal)).toThrow(expect.objectContaining({ kind: 'cancelled' }));
  });
  it('classifies write failures with unknown-commit semantics', () => {
    expect(() => checkWrite(offline)).toThrow(expect.objectContaining({ kind: 'unknown-commit' }));
    expect(() => checkWrite({ error: null })).not.toThrow();
  });
  it('escapes resident search text for ilike patterns and PostgREST logic trees', () => {
    expect(containsPattern('  ')).toBeNull();
    expect(containsPattern('50%_off\\')).toBe('%50\\%\\_off\\\\%');
    expect(containsPattern('a*b')).toBe('%ab%');
    expect(quoteFilterValue('%a,b.(c)"d\\%')).toBe('"%a,b.(c)\\"d\\\\%"');
  });
});

describe('single-flight mutations (P02-T02, F03)', () => {
  it('sends at most one attempt for rapid double activation', async () => {
    const gate = createSingleFlight();
    let calls = 0;
    let release: () => void = () => undefined;
    const operation = () => new Promise<string>((resolve) => { calls++; release = () => resolve('ok'); });
    const first = gate.run(operation);
    const second = await gate.run(operation);
    expect(second).toEqual({ status: 'busy' });
    release();
    expect(await first).toEqual({ status: 'committed', value: 'ok' });
    expect(calls).toBe(1);
  });
  it('reports a lost reply as unknown and does not retry it', async () => {
    const gate = createSingleFlight();
    let calls = 0;
    const outcome = await gate.run(async () => { calls++; throw offline.error; });
    expect(outcome.status).toBe('unknown');
    expect(calls).toBe(1);
    expect(gate.running).toBe(false);
  });
  it('reports a definite rejection as failed with its kind', async () => {
    const outcome = await createSingleFlight().run(async () => { throw new DataError('authorization'); });
    expect(outcome).toMatchObject({ status: 'failed', kind: 'authorization' });
  });
});

describe('resident error copy', () => {
  it('keeps contract-specific messages and never leaks raw provider text', () => {
    expect(residentError({ code: 'P0004', message: 'duplicate key value violates unique constraint "x"' })).toBe('You are already registered for this activity.');
    expect(residentError(new DataError('conflict', 'x', 409, 'P0003'))).toBe('There are no remaining slots for this activity.');
    expect(residentError(new PublicError('Choose a JPG.'))).toBe('Choose a JPG.');
    expect(residentError(new DataError('unknown-commit'))).toContain('could not confirm');
    expect(residentError({ message: 'relation "secret_table" does not exist', code: '42P01' })).not.toContain('secret_table');
  });
});
