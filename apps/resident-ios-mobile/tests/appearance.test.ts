import { createClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { contrastRatio, hexToHsv, hsvToHex, isValidHex, mixColors, normalizeHex } from '../src/lib/color-math';
import { basePalette, DEFAULT_ACCENT, derivePalette } from '../src/lib/palette';
import {
  COLOR_PROBLEM_COPY, DEFAULT_PREFERENCES, FONT_CHOICES, fontFamilyFor, MAX_CUSTOM_COLORS, normalizeCustomColors, planAddColor, planRemoveColor,
  PRESET_COLORS, PreferenceStore, preferencesFromProfile, SAVE_FAILED_COPY, toColumns, type Preferences,
} from '../src/features/appearance/preferences';
import { persistPreferences } from '../src/features/appearance/save';

describe('color math', () => {
  it('validates #RRGGBB only and normalizes to uppercase', () => {
    expect(isValidHex('#0F6E5B')).toBe(true);
    expect(isValidHex('#0f6e5b')).toBe(true);
    for (const bad of ['0F6E5B', '#0F6E5', '#0F6E5BB', '#GGGGGG', '', 'red', '#0F6E5B ']) expect(isValidHex(bad), bad).toBe(false);
    expect(normalizeHex('#0f6e5b')).toBe('#0F6E5B');
  });
  it('round-trips HSV for primaries, greys and every preset', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvToHex({ h: 120, s: 1, v: 1 })).toBe('#00FF00');
    expect(hsvToHex({ h: 240, s: 1, v: 0.5 })).toBe('#000080');
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe('#FFFFFF');
    expect(hsvToHex({ h: 360, s: 1, v: 1 })).toBe('#FF0000');
    for (const { color } of PRESET_COLORS) expect(hsvToHex(hexToHsv(color)), color).toBe(color);
  });
  it('computes WCAG contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    // Handoff §5 approved pairing: onPrimary / light primary = 6.43:1.
    expect(contrastRatio('#FFFFFF', '#0D6B59')).toBeCloseTo(6.43, 1);
  });
  it('mixes colors linearly in sRGB channels', () => {
    expect(mixColors('#000000', '#FFFFFF', 0)).toBe('#000000');
    expect(mixColors('#000000', '#FFFFFF', 1)).toBe('#FFFFFF');
    expect(mixColors('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
});

describe('accent palette (T43 contrast)', () => {
  const fixed = ['success', 'warning', 'danger', 'info'] as const;
  it('uses the handoff tokens untouched for the default accent and for malformed values', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(derivePalette(scheme, DEFAULT_ACCENT)).toEqual(basePalette(scheme));
      expect(derivePalette(scheme, DEFAULT_ACCENT.toLowerCase())).toEqual(basePalette(scheme));
      expect(derivePalette(scheme, null)).toEqual(basePalette(scheme));
      expect(derivePalette(scheme, 'javascript:alert(1)')).toEqual(basePalette(scheme));
    }
  });
  const accents = [...PRESET_COLORS.map((preset) => preset.color), '#FFFF00', '#FFFFFF', '#000000', '#000033', '#FFD700', '#7FFFD4'];
  it('keeps text and action colors readable for every preset and extreme custom color in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const base = basePalette(scheme);
      for (const accent of accents) {
        const palette = derivePalette(scheme, accent);
        expect(contrastRatio(palette.primary, base.surface), `${scheme} ${accent} on surface`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.primary, base.canvas), `${scheme} ${accent} on canvas`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.onPrimary, palette.primary), `${scheme} ${accent} label`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(palette.textPrimary, palette.surfaceSelected), `${scheme} ${accent} selected`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('never changes status colors or surfaces with the accent', () => {
    for (const scheme of ['light', 'dark'] as const) {
      const base = basePalette(scheme);
      for (const accent of accents) {
        const palette = derivePalette(scheme, accent);
        for (const key of fixed) expect(palette[key]).toBe(base[key]);
        expect(palette.canvas).toBe(base.canvas);
        expect(palette.surface).toBe(base.surface);
        expect(palette.danger).not.toBe(palette.success);
      }
    }
  });
  it('keeps a contrasting focus boundary when the accent is close to the focus color', () => {
    const palette = derivePalette('light', '#0A70D1');
    expect(contrastRatio(palette.primary, palette.focus)).toBeGreaterThanOrEqual(1.5);
  });
});

describe('stored preferences', () => {
  const row = { theme_preference: 'dark', accent_color: '#2563eb', custom_accent_colors: ['#123456', '#ABCDEF'], font_preference: 'georgia' };
  it('reads valid columns and canonicalizes colors', () => {
    expect(preferencesFromProfile(row)).toEqual({ theme: 'dark', accent: '#2563EB', customColors: ['#123456', '#ABCDEF'], font: 'georgia' });
    expect(preferencesFromProfile(null)).toEqual(DEFAULT_PREFERENCES);
  });
  it('falls back on malformed stored values instead of failing', () => {
    expect(preferencesFromProfile({ theme_preference: 'purple', accent_color: 'red', custom_accent_colors: [], font_preference: '' }))
      .toEqual({ theme: 'system', accent: DEFAULT_ACCENT, customColors: [], font: 'system' });
  });
  it('drops invalid and duplicate custom colors and caps the list at ten', () => {
    const many = Array.from({ length: 14 }, (_, index) => `#${(index + 1).toString(16).padStart(2, '0').repeat(3)}`);
    expect(normalizeCustomColors(['#AABBCC', '#aabbcc', 'nope', '#12345', ...many])).toHaveLength(MAX_CUSTOM_COLORS);
    expect(normalizeCustomColors(['#AABBCC', '#aabbcc'])).toEqual(['#AABBCC']);
    expect(preferencesFromProfile({ ...row, custom_accent_colors: 'oops' as unknown as string[] }).customColors).toEqual([]);
  });
  it('maps each preference to its profile column', () => {
    expect(toColumns({ theme: 'light' })).toEqual({ theme_preference: 'light' });
    expect(toColumns({ accent: '#112233', customColors: ['#112233'] })).toEqual({ accent_color: '#112233', custom_accent_colors: ['#112233'] });
    expect(toColumns({ font: 'arial' })).toEqual({ font_preference: 'arial' });
    expect(toColumns({})).toEqual({});
  });
});

describe('fonts (T43 all ten IDs)', () => {
  it('offers exactly the ten mobile IDs in the shared order, without web-only faces', () => {
    expect(FONT_CHOICES.map((choice) => choice.id)).toEqual(['system', 'inter', 'arial', 'helvetica', 'segoe-ui', 'verdana', 'tahoma', 'trebuchet-ms', 'georgia', 'times-new-roman']);
  });
  it('maps to qualified iOS families and falls back to the system face without downloading anything', () => {
    expect(fontFamilyFor('arial')).toBe('Arial');
    expect(fontFamilyFor('helvetica')).toBe('Helvetica Neue');
    expect(fontFamilyFor('verdana')).toBe('Verdana');
    expect(fontFamilyFor('trebuchet-ms')).toBe('Trebuchet MS');
    expect(fontFamilyFor('georgia')).toBe('Georgia');
    expect(fontFamilyFor('times-new-roman')).toBe('Times New Roman');
    for (const id of ['system', 'inter', 'segoe-ui', 'tahoma', 'garamond', 'courier-new', 'unknown']) expect(fontFamilyFor(id), id).toBeUndefined();
  });
  it('flags only the faces iOS lacks as fallbacks (Inter is not claimed as bundled)', () => {
    expect(FONT_CHOICES.filter((choice) => choice.fallback).map((choice) => choice.id)).toEqual(['inter', 'segoe-ui', 'tahoma']);
  });
});

describe('custom colors', () => {
  const base: Preferences = { ...DEFAULT_PREFERENCES };
  const saved = (count: number): Preferences => ({ ...base, customColors: Array.from({ length: count }, (_, index) => `#0${index}1122`) });
  it('rejects malformed, preset and duplicate colors with specific problems', () => {
    expect(planAddColor(base, 'blue')).toEqual({ ok: false, problem: 'invalid' });
    expect(planAddColor(base, '#12345G')).toEqual({ ok: false, problem: 'invalid' });
    expect(planAddColor(base, '#2563eb')).toEqual({ ok: false, problem: 'preset' });
    expect(planAddColor(saved(1), '#001122')).toEqual({ ok: false, problem: 'duplicate' });
    expect(planAddColor(saved(1), '#001122'.toLowerCase())).toEqual({ ok: false, problem: 'duplicate' });
  });
  it('saves a new color first and applies it; the tenth succeeds and the eleventh is refused', () => {
    const added = planAddColor(saved(1), '#abcdef');
    expect(added).toEqual({ ok: true, change: { customColors: ['#ABCDEF', '#001122'], accent: '#ABCDEF' } });
    expect(planAddColor(saved(9), '#ABCDEF').ok).toBe(true);
    expect(planAddColor(saved(10), '#ABCDEF')).toEqual({ ok: false, problem: 'limit' });
    expect(COLOR_PROBLEM_COPY.limit).toContain('10');
  });
  it('removing the selected color returns to the default accent; other removals keep the accent', () => {
    const state: Preferences = { ...base, accent: '#001122', customColors: ['#001122', '#334455'] };
    expect(planRemoveColor(state, '#001122')).toEqual({ customColors: ['#334455'], accent: DEFAULT_ACCENT });
    expect(planRemoveColor(state, '#334455')).toEqual({ customColors: ['#001122'] });
    expect(planRemoveColor(state, '#001122'.toLowerCase())).toEqual({ customColors: ['#334455'], accent: DEFAULT_ACCENT });
  });
});

function deferred() {
  let resolve!: () => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('PreferenceStore (A43-020, F04/F07 optimistic rollback)', () => {
  it('keeps guest or pre-profile choices for the session and never fails', () => {
    const store = new PreferenceStore(DEFAULT_PREFERENCES, null);
    store.apply({ theme: 'dark' });
    expect(store.getSnapshot()).toMatchObject({ preferences: { theme: 'dark' }, persistent: false, save: { status: 'idle' } });
  });
  it('shows a change at once, saves it, and reports no error', async () => {
    const writes: unknown[] = [];
    const store = new PreferenceStore(DEFAULT_PREFERENCES, async (columns) => { writes.push(columns); });
    store.apply({ accent: '#112233' });
    expect(store.getSnapshot().preferences.accent).toBe('#112233');
    expect(store.getSnapshot().save.status).toBe('saving');
    await flush();
    expect(writes).toEqual([{ accent_color: '#112233' }]);
    expect(store.getSnapshot().save).toEqual({ status: 'idle', message: null });
  });
  it('restores the confirmed value and explains when a write fails', async () => {
    const store = new PreferenceStore(DEFAULT_PREFERENCES, async () => { throw new Error('boom'); });
    store.apply({ theme: 'dark' });
    expect(store.getSnapshot().preferences.theme).toBe('dark');
    await flush();
    expect(store.getSnapshot().preferences.theme).toBe('system');
    expect(store.getSnapshot().save).toEqual({ status: 'failed', message: SAVE_FAILED_COPY });
    store.dismissError();
    expect(store.getSnapshot().save.status).toBe('idle');
  });
  it('does not roll back a preference that a newer change replaced, and sends writes in order', async () => {
    const first = deferred();
    const second = deferred();
    const calls: string[] = [];
    const pending = [first, second];
    const store = new PreferenceStore(DEFAULT_PREFERENCES, async (columns) => { calls.push(String(columns.accent_color)); await pending.shift()!.promise; });
    store.apply({ accent: '#111111' });
    store.apply({ accent: '#222222' });
    await flush();
    expect(calls).toEqual(['#111111']);
    first.reject(new Error('offline'));
    await flush();
    // The first write failed, but the resident has since chosen #222222; it must stay.
    expect(store.getSnapshot().preferences.accent).toBe('#222222');
    expect(calls).toEqual(['#111111', '#222222']);
    second.resolve();
    await flush();
    expect(store.getSnapshot().preferences.accent).toBe('#222222');
  });
  it('rolls back only the failed fields of a multi-field change', async () => {
    const store = new PreferenceStore({ ...DEFAULT_PREFERENCES, customColors: ['#112233'], accent: '#112233' }, async () => { throw new Error('x'); });
    store.apply({ customColors: [], accent: DEFAULT_ACCENT });
    await flush();
    expect(store.getSnapshot().preferences).toMatchObject({ customColors: ['#112233'], accent: '#112233' });
  });
  it('ignores a no-op selection without writing', async () => {
    let writes = 0;
    const store = new PreferenceStore(DEFAULT_PREFERENCES, async () => { writes++; });
    store.apply({ theme: 'system', customColors: [] });
    await flush();
    expect(writes).toBe(0);
  });
});

describe('persistPreferences', () => {
  const USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  function harness(reply: { status?: number; body?: unknown } | 'network-error') {
    const requests: { url: URL; method: string; body: unknown }[] = [];
    const fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      requests.push({ url: new URL(String(input)), method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
      if (reply === 'network-error') throw new TypeError('Network request failed');
      return new Response(JSON.stringify(reply.body ?? []), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
    };
    const client = createClient<Database>('https://example.supabase.co', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch } });
    return { client, requests };
  }
  it('updates only the resident’s own row with the changed columns', async () => {
    const { client, requests } = harness({ body: [{ id: USER }] });
    await persistPreferences(client, USER)({ accent_color: '#112233', custom_accent_colors: ['#112233'] });
    expect(requests).toHaveLength(1);
    expect(requests[0].method).toBe('PATCH');
    expect(requests[0].url.searchParams.get('id')).toBe(`eq.${USER}`);
    expect(requests[0].body).toEqual({ accent_color: '#112233', custom_accent_colors: ['#112233'] });
  });
  it('fails when no row matched, so the change is rolled back instead of kept', async () => {
    const { client } = harness({ body: [] });
    await expect(persistPreferences(client, USER)({ theme_preference: 'dark' })).rejects.toMatchObject({ kind: 'not-found' });
  });
  it('classifies a lost connection as an unknown commit and a denial as authorization', async () => {
    await expect(persistPreferences(harness('network-error').client, USER)({ font_preference: 'arial' })).rejects.toMatchObject({ kind: 'unknown-commit' });
    const denied = harness({ status: 403, body: { code: '42501', message: 'denied' } });
    await expect(persistPreferences(denied.client, USER)({ font_preference: 'arial' })).rejects.toMatchObject({ kind: 'authorization' });
  });
});

describe('introduction entry (A02, A52-011)', () => {
  const src = (...parts: string[]) => readFileSync(join(__dirname, '..', 'src', ...parts), 'utf8');
  it('leaves account choice as the signed-out root and offers the introduction without forcing it', () => {
    const root = src('app', 'index.tsx');
    expect(root).toContain("'/auth/choice'");
    expect(root).not.toContain('onboarding');
    const choice = src('features', 'auth', 'choice-screen.tsx');
    expect(choice).toContain('/onboarding/welcome');
    expect(choice).not.toMatch(/router\.replace\('\/onboarding/);
  });
  it('lets the resident leave every introduction screen', () => {
    const frame = src('features', 'onboarding', 'frame.tsx');
    expect(frame).toContain('Skip introduction');
    expect(frame).toContain('router.canDismiss()');
    expect(src('features', 'onboarding', 'screens.tsx')).toContain('Get started');
  });
});
