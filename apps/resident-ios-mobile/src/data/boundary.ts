import type { ZodType } from 'zod';
import { DataError, toDataError } from './outcome';

/** The parts of a supabase-js response the boundary needs. Data stays `unknown` until parsed. */
export type RawResponse = { data: unknown; error: unknown; status?: number; count?: number | null };

function check(response: RawResponse, signal?: AbortSignal) {
  if (signal?.aborted) throw new DataError('cancelled');
  if (response.error) throw toDataError(response.error, { status: response.status, signal });
}

function parse<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  // Never surface the raw payload: it may hold personal data.
  if (!result.success) throw new DataError('schema', 'The server response did not match the expected format.');
  return result.data;
}

/** A list read. A valid empty array is data, not an error. */
export function parseRows<T>(schema: ZodType<T>, response: RawResponse, signal?: AbortSignal): T[] {
  check(response, signal);
  if (!Array.isArray(response.data)) throw new DataError('schema', 'The server response did not match the expected format.');
  return response.data.map((row) => parse(schema, row));
}

/** A `maybeSingle()` read: `null` means the record is absent or not visible to this account. */
export function parseMaybeRow<T>(schema: ZodType<T>, response: RawResponse, signal?: AbortSignal): T | null {
  check(response, signal);
  return response.data === null ? null : parse(schema, response.data);
}

/** A `single()` read or RPC result where absence is itself a contract failure. */
export function parseRow<T>(schema: ZodType<T>, response: RawResponse, signal?: AbortSignal): T {
  check(response, signal);
  if (response.data === null || response.data === undefined) throw new DataError('not-found');
  return parse(schema, response.data);
}

/** A `count: 'exact', head: true` read. A missing count is a contract failure, never zero. */
export function parseCount(response: RawResponse, signal?: AbortSignal): number {
  check(response, signal);
  if (typeof response.count !== 'number' || !Number.isInteger(response.count) || response.count < 0) {
    throw new DataError('schema', 'The server did not return a count.');
  }
  return response.count;
}

/** A write whose transport failure leaves the outcome unknown. */
export function checkWrite(response: { error: unknown; status?: number }): void {
  if (response.error) throw toDataError(response.error, { status: response.status, write: true });
}

/**
 * Escapes a resident search term for a PostgREST `ilike` pattern: `%`, `_` and `\` are
 * literal, and the term is wrapped for a contains-match. PostgREST turns `*` into a
 * wildcard inside like patterns and offers no escape for it, so `*` is dropped.
 * Returns null for a blank term.
 */
export function containsPattern(term: string, maxLength = 100): string | null {
  const trimmed = term.replace(/\*/g, '').trim().slice(0, maxLength);
  if (!trimmed) return null;
  return `%${trimmed.replace(/[\\%_]/g, (character) => `\\${character}`)}%`;
}

/** Quotes a value inside a PostgREST `or=(…)` logic tree, where `,` `.` `:` `(` `)` are reserved. */
export function quoteFilterValue(value: string): string {
  return `"${value.replace(/["\\]/g, (character) => `\\${character}`)}"`;
}
