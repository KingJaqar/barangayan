import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { registrationLocality, RegistrationLocalityError } from './resident-auth';

const locality = { barangay_id: 'own-barangay', display_name: 'Own Barangay', city: 'Own City', province: 'Own Province', resident_registration_enabled: false };
const barangay = { id: locality.barangay_id, boundary: null };
type Response = { data: unknown; error: { code: string } | null };
function fixture(localityResponse: Response = { data: locality, error: null }, boundaryResponse: Response = { data: barangay, error: null }) {
  const filters: { table: string; column: string; value: unknown }[] = [];
  const signals: AbortSignal[] = [];
  const from = vi.fn((table: string) => ({
    select: vi.fn(() => ({
      eq: vi.fn((column: string, value: unknown) => {
        filters.push({ table, column, value });
        return { abortSignal: vi.fn((signal: AbortSignal) => {
          signals.push(signal);
          return { maybeSingle: vi.fn(async () => table === 'barangay_localities' ? localityResponse : boundaryResponse) };
        }) };
      }),
    })),
  }));
  return { client: { from } as unknown as SupabaseClient<Database>, filters, signals, from };
}
afterEach(() => vi.useRealTimers());

describe('registration locality read boundaries', () => {
  it('uses only the enabled registration locality for a new profile', async () => {
    const f = fixture();
    await expect(registrationLocality(f.client)).resolves.toEqual({ ...barangay, name: locality.display_name, city: locality.city, province: locality.province });
    expect(f.filters).toEqual([{ table: 'barangay_localities', column: 'resident_registration_enabled', value: true }, { table: 'barangays', column: 'id', value: locality.barangay_id }]);
  });
  it('keeps an existing resident in their own locality even when registration there is disabled', async () => {
    const f = fixture();
    await registrationLocality(f.client, { barangayId: locality.barangay_id });
    expect(f.filters[0]).toEqual({ table: 'barangay_localities', column: 'barangay_id', value: locality.barangay_id });
    expect(f.filters).toHaveLength(2);
  });
  it.each([{ data: null, error: null }, { data: null, error: { code: 'PGRST116' } }])('fails closed on missing or ambiguous configuration', async response => {
    const f = fixture(response);
    await expect(registrationLocality(f.client)).rejects.toMatchObject({ name: 'RegistrationLocalityError', stage: 'locality', retryable: false });
    expect(f.from).toHaveBeenCalledTimes(1);
  });
  it('distinguishes boundary failure from profile/locality failure', async () => {
    const f = fixture(undefined, { data: null, error: { code: '503' } });
    await expect(registrationLocality(f.client)).rejects.toMatchObject({ stage: 'boundary', retryable: true });
  });
  it('permits a missing advisory polygon but rejects a missing barangay row', async () => {
    await expect(registrationLocality(fixture().client)).resolves.toMatchObject({ boundary: null });
    await expect(registrationLocality(fixture(undefined, { data: null, error: null }).client)).rejects.toMatchObject({ stage: 'boundary', retryable: false });
  });
  it('does not start reads after cancellation and shares the caller signal across both reads', async () => {
    const controller = new AbortController(), f = fixture();
    await registrationLocality(f.client, { signal: controller.signal });
    expect(f.signals).toEqual([controller.signal, controller.signal]);
    controller.abort();
    const cancelled = fixture();
    await expect(registrationLocality(cancelled.client, { signal: controller.signal })).rejects.toBeInstanceOf(RegistrationLocalityError);
    expect(cancelled.from).not.toHaveBeenCalled();
  });
  it('does not start the boundary read after cancellation between requests', async () => {
    const controller = new AbortController();
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => { controller.abort(); return { data: locality, error: null }; } }) }) }) }));
    await expect(registrationLocality({ from } as unknown as SupabaseClient<Database>, { signal: controller.signal })).rejects.toMatchObject({ stage: 'boundary' });
    expect(from).toHaveBeenCalledTimes(1);
  });
  it('clears its deadline on success and on rejected transports', async () => {
    vi.useFakeTimers();
    await registrationLocality(fixture().client);
    expect(vi.getTimerCount()).toBe(0);
    const client = { from: () => { throw new Error('private transport details'); } } as unknown as SupabaseClient<Database>;
    await expect(registrationLocality(client)).rejects.toThrow('Unable to load registration details. Check your connection and retry.');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('aborts a stalled default lookup at its deadline and releases the timer', async () => {
    vi.useFakeTimers();
    const client = { from: () => ({ select: () => ({ eq: () => ({ abortSignal: (signal: AbortSignal) => ({ maybeSingle: () => new Promise(resolve => signal.addEventListener('abort', () => resolve({ data: null, error: { code: '' } }), { once: true })) }) }) }) }) } as unknown as SupabaseClient<Database>;
    const result = expect(registrationLocality(client)).rejects.toMatchObject({ stage: 'locality', retryable: true });
    await vi.advanceTimersByTimeAsync(10000);
    await result;
    expect(vi.getTimerCount()).toBe(0);
  });
});
