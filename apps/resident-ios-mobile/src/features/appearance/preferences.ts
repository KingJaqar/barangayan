import { ACCENT_COLORS, FONT_OPTIONS, type Tables } from '@barangayan/shared';
import { isValidHex, normalizeHex, sameColor } from '../../lib/color-math';
import { DEFAULT_ACCENT } from '../../lib/palette';

export type ThemePreference = 'light' | 'dark' | 'system';
export const THEME_CHOICES: readonly { value: ThemePreference; label: string; detail: string }[] = [
  { value: 'system', label: 'System', detail: 'Match your iPhone appearance' },
  { value: 'light', label: 'Light', detail: 'Always use the light appearance' },
  { value: 'dark', label: 'Dark', detail: 'Always use the dark appearance' },
];
/** Same cap as the `custom_accent_colors` check constraint (migration 0075) and the other apps. */
export const MAX_CUSTOM_COLORS = 10;

export type Preferences = {
  theme: ThemePreference;
  accent: string;
  /** Most recently saved first. */
  customColors: string[];
  /** A persisted font ID; IDs this phone does not offer (web-only faces) are kept, not overwritten. */
  font: string;
};
export const DEFAULT_PREFERENCES: Preferences = { theme: 'system', accent: DEFAULT_ACCENT, customColors: [], font: 'system' };

const COLOR_NAMES: Record<string, string> = {
  '#0F6E5B': 'Barangay green', '#2563EB': 'Blue', '#DC2626': 'Red', '#7C3AED': 'Purple', '#EA580C': 'Orange', '#0D9488': 'Teal', '#DB2777': 'Pink',
  '#CA8A04': 'Amber', '#4F46E5': 'Indigo', '#16A34A': 'Emerald', '#0891B2': 'Cyan', '#9333EA': 'Violet', '#E11D48': 'Rose', '#65A30D': 'Lime',
  '#C026D3': 'Fuchsia', '#B45309': 'Bronze', '#334155': 'Slate', '#0369A1': 'Sky', '#B91C1C': 'Crimson', '#166534': 'Forest',
};
export const PRESET_COLORS: readonly { color: string; name: string }[] = ACCENT_COLORS.map((color) => ({ color, name: COLOR_NAMES[color] ?? color }));

/** Normalizes a stored list: valid `#RRGGBB` only, case-insensitive de-duplication, at most ten. */
export function normalizeCustomColors(colors: readonly string[]): string[] {
  const result: string[] = [];
  for (const color of colors) {
    if (!isValidHex(color) || result.some((saved) => sameColor(saved, color))) continue;
    result.push(normalizeHex(color));
    if (result.length === MAX_CUSTOM_COLORS) break;
  }
  return result;
}

type ProfileAppearance = Pick<Tables<'profiles'>, 'theme_preference' | 'accent_color' | 'custom_accent_colors' | 'font_preference'>;
/** Reads stored preferences defensively; malformed values fall back to the defaults. */
export function preferencesFromProfile(row: ProfileAppearance | null): Preferences {
  if (!row) return DEFAULT_PREFERENCES;
  const theme = THEME_CHOICES.some((choice) => choice.value === row.theme_preference) ? (row.theme_preference as ThemePreference) : 'system';
  return {
    theme,
    accent: isValidHex(row.accent_color) ? normalizeHex(row.accent_color) : DEFAULT_ACCENT,
    customColors: normalizeCustomColors(Array.isArray(row.custom_accent_colors) ? row.custom_accent_colors : []),
    font: row.font_preference || 'system',
  };
}

/** The `profiles` columns each preference is stored in. */
export function toColumns(change: Partial<Preferences>): Partial<Pick<Tables<'profiles'>, 'theme_preference' | 'accent_color' | 'custom_accent_colors' | 'font_preference'>> {
  return {
    ...(change.theme !== undefined && { theme_preference: change.theme }),
    ...(change.accent !== undefined && { accent_color: change.accent }),
    ...(change.customColors !== undefined && { custom_accent_colors: change.customColors }),
    ...(change.font !== undefined && { font_preference: change.font }),
  };
}

// --- Fonts -------------------------------------------------------------------------------
/** The ten mobile choices; the two web-admin-only faces (Garamond, Courier New) are not mobile parity. */
const WEB_ONLY = new Set(['garamond', 'courier-new']);
/**
 * Faces iOS ships (or the system face). Nothing is downloaded or bundled: where iOS has no such
 * family the preference stays selectable and the system face is used, and the chip says so.
 */
const IOS_FAMILY: Record<string, string | undefined> = {
  arial: 'Arial', helvetica: 'Helvetica Neue', verdana: 'Verdana', 'trebuchet-ms': 'Trebuchet MS', georgia: 'Georgia', 'times-new-roman': 'Times New Roman',
};
export type FontChoice = { id: string; label: string; family: string | undefined; fallback: boolean };
export const FONT_CHOICES: readonly FontChoice[] = FONT_OPTIONS.filter((option) => !WEB_ONLY.has(option.id)).map((option) => ({
  id: option.id, label: option.label, family: IOS_FAMILY[option.id], fallback: option.id !== 'system' && IOS_FAMILY[option.id] === undefined,
}));

/** The family to render for a stored font ID; unknown IDs render with the system face. */
export function fontFamilyFor(id: string): string | undefined {
  return FONT_CHOICES.find((choice) => choice.id === id)?.family;
}

// --- Custom colors -----------------------------------------------------------------------
export type ColorProblem = 'invalid' | 'duplicate' | 'preset' | 'limit';
export const COLOR_PROBLEM_COPY: Record<ColorProblem, string> = {
  invalid: 'Enter a color as #RRGGBB, for example #0F6E5B.',
  duplicate: 'That color is already saved.',
  preset: 'That color is already one of the preset colors.',
  limit: `You can save up to ${MAX_CUSTOM_COLORS} custom colors. Remove one to add another.`,
};

/** Validates a new custom color and returns the change that saves and applies it. */
export function planAddColor(current: Preferences, input: string): { ok: true; change: Partial<Preferences> } | { ok: false; problem: ColorProblem } {
  if (!isValidHex(input)) return { ok: false, problem: 'invalid' };
  if (PRESET_COLORS.some((preset) => sameColor(preset.color, input))) return { ok: false, problem: 'preset' };
  if (current.customColors.some((saved) => sameColor(saved, input))) return { ok: false, problem: 'duplicate' };
  if (current.customColors.length >= MAX_CUSTOM_COLORS) return { ok: false, problem: 'limit' };
  const color = normalizeHex(input);
  return { ok: true, change: { customColors: [color, ...current.customColors], accent: color } };
}

/** Removing the color in use returns to the default accent, so a removed color is never left selected. */
export function planRemoveColor(current: Preferences, color: string): Partial<Preferences> {
  const customColors = current.customColors.filter((saved) => !sameColor(saved, color));
  return sameColor(current.accent, color) ? { customColors, accent: DEFAULT_ACCENT } : { customColors };
}

// --- Persistence with visible rollback ------------------------------------------------------
export type SaveState = { status: 'idle' | 'saving' | 'failed'; message: string | null };
export type PreferenceSnapshot = { preferences: Preferences; save: SaveState; persistent: boolean };
export type Persist = (columns: ReturnType<typeof toColumns>) => Promise<void>;
export const SAVE_FAILED_COPY = 'Your appearance change could not be saved, so it was undone. Check your connection and try again.';

const same = (a: Preferences[keyof Preferences], b: Preferences[keyof Preferences]) =>
  Array.isArray(a) && Array.isArray(b) ? a.length === b.length && a.every((value, index) => value === b[index]) : a === b;

/**
 * Optimistic preference state. A resident's change shows at once; a persisted account's write is
 * sent in order, and a failed write restores that preference (unless a newer change replaced it)
 * with a visible explanation. Without a `persist` function (guest, or no profile row yet) changes
 * are session-only and cannot fail.
 */
export class PreferenceStore {
  private confirmed: Preferences;
  private current: Preferences;
  private save: SaveState = { status: 'idle', message: null };
  private inFlight = 0;
  private tail: Promise<void> = Promise.resolve();
  private readonly listeners = new Set<() => void>();
  private snapshot: PreferenceSnapshot;

  constructor(initial: Preferences, private readonly persist: Persist | null) {
    this.confirmed = initial;
    this.current = initial;
    this.snapshot = this.build();
  }

  readonly subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  readonly getSnapshot = () => this.snapshot;

  apply(change: Partial<Preferences>) {
    const keys = (Object.keys(change) as (keyof Preferences)[]).filter((key) => !same(change[key] as Preferences[typeof key], this.current[key]));
    if (keys.length === 0) return;
    const attempted: Partial<Preferences> = {};
    for (const key of keys) (attempted as Record<string, unknown>)[key] = change[key];
    this.current = { ...this.current, ...attempted };
    const persist = this.persist;
    if (!persist) {
      this.confirmed = this.current;
      this.publish();
      return;
    }
    this.inFlight++;
    this.save = { status: 'saving', message: null };
    this.publish();
    this.tail = this.tail.then(async () => {
      try {
        await persist(toColumns(attempted));
        this.confirmed = { ...this.confirmed, ...attempted };
        this.inFlight--;
        if (this.inFlight === 0 && this.save.status === 'saving') this.save = { status: 'idle', message: null };
      } catch {
        this.inFlight--;
        const restored: Record<string, unknown> = { ...this.current };
        for (const key of keys) if (same(this.current[key], attempted[key] as Preferences[typeof key])) restored[key] = this.confirmed[key];
        this.current = restored as Preferences;
        this.save = { status: 'failed', message: SAVE_FAILED_COPY };
      }
      this.publish();
    });
  }

  dismissError() {
    if (this.save.status !== 'failed') return;
    this.save = { status: 'idle', message: null };
    this.publish();
  }

  private build(): PreferenceSnapshot {
    return { preferences: this.current, save: this.save, persistent: this.persist !== null };
  }
  private publish() {
    this.snapshot = this.build();
    this.listeners.forEach((listener) => listener());
  }
}
