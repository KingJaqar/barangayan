'use client';

import { ACCENT_COLORS, FONT_OPTIONS } from '@barangayan/shared';
import { Bell, Check, LayoutDashboard, Pipette, Plus, Search, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { hasStoredAccent, isValidHexColor, MAX_CUSTOM_COLORS, useAccentController } from '@/components/ui/accent-controller';
import { hasStoredFont, useFontController } from '@/components/ui/font-controller';
import { hasStoredTheme, useThemeController } from '@/components/ui/theme-controller';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ThemeFormProps {
  initialTheme: 'light' | 'dark' | 'system';
  initialAccentColor: string;
  initialCustomColors: string[];
  initialFontId: string;
}

/**
 * Which of the two buttons reads as "selected" is expressed purely in CSS, keyed off the
 * `.dark` class that THEME_INIT_SCRIPT puts on <html> before first paint. Deriving these
 * classes from the `theme` state instead would hydration-mismatch: the server always
 * renders 'light', while the client's first render already sees the restored theme.
 */
const SELECTION_CLASS = {
  // Selected in light mode, deselected in dark mode.
  light:
    'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)] dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300',
  // Deselected in light mode, selected in dark mode.
  dark: 'border-zinc-300 bg-transparent text-zinc-600 dark:border-[var(--accent)] dark:bg-[var(--accent)]/10 dark:text-[var(--accent)]',
} as const;

export function ThemeForm({ initialTheme, initialAccentColor, initialCustomColors, initialFontId }: ThemeFormProps) {
  const { theme, setTheme } = useThemeController();
  const { accent, setAccent, customColors, setCustomColors, addCustomColor, removeCustomColor } = useAccentController();
  const { fontId, setFontId } = useFontController();
  const [saved, setSaved] = useState(false);
  const [customHex, setCustomHex] = useState(initialAccentColor);
  const [customHexError, setCustomHexError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const didReconcile = useRef(false);

  // Reconcile local (localStorage-backed) state with the DB only on a genuinely
  // first-ever visit to this browser — i.e. localStorage never had a value at all.
  // This used to run on every mount (every navigation to /theme), which meant simply
  // clicking the "Theme" sidebar link could silently revert a theme/accent/font the admin
  // had already set locally, back to whatever the DB happened to hold. The sidebar link is
  // navigation only; it must never itself change the live theme.
  useEffect(() => {
    if (didReconcile.current) return;
    didReconcile.current = true;

    if (!hasStoredTheme() && (initialTheme === 'light' || initialTheme === 'dark')) {
      setTheme(initialTheme);
    }
    if (!hasStoredAccent() && isValidHexColor(initialAccentColor)) {
      setAccent(initialAccentColor);
      // First-ever-visit reconciliation, not a synchronization loop — see comment above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomHex(initialAccentColor);
    }
    if (!hasStoredFont() && initialFontId) {
      setFontId(initialFontId);
    }
    // Saved custom-color swatches aren't "live UI state" the way theme/accent/font are —
    // nothing else on the page can change them out from under this reconciliation, so it's
    // safe (and correct) to always adopt the DB list here rather than gate it too.
    if (initialCustomColors.length) {
      setCustomColors(initialCustomColors);
    }
    // Intentionally run once on mount only — see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(next: {
    theme?: 'light' | 'dark';
    accentColor?: string;
    customColors?: string[];
    fontId?: string;
  }) {
    setSaved(false);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from('profiles')
      .update({
        theme_preference: next.theme ?? theme,
        accent_color: next.accentColor ?? accent,
        custom_accent_colors: next.customColors ?? customColors,
        font_preference: next.fontId ?? fontId,
      })
      .eq('id', user.id);
    if (!error) setSaved(true);
  }

  function handleThemeChange(option: 'light' | 'dark') {
    setTheme(option); // flips the .dark class on <html> immediately — the actual fix
    persist({ theme: option }); // fire-and-forget DB sync for other devices
  }

  function handleAccentChange(color: string) {
    setAccent(color); // updates the --accent CSS var on <html> immediately
    setCustomHex(color); // keep the hex field in sync with swatch picks
    persist({ accentColor: color }); // fire-and-forget DB sync for other devices
  }

  function handleCustomHexInput(value: string) {
    setCustomHex(value);
    const normalized = value.startsWith('#') ? value : `#${value}`;
    if (isValidHexColor(normalized)) {
      setCustomHexError(false);
      handleAccentChange(normalized);
    } else {
      setCustomHexError(value.length > 0);
    }
  }

  function handleSaveCustomColor() {
    if (!isValidHexColor(customHex)) return;
    const added = addCustomColor(customHex);
    if (!added) return;
    persist({ customColors: [customHex, ...customColors].slice(0, MAX_CUSTOM_COLORS) });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  function handleRemoveCustomColor(color: string) {
    removeCustomColor(color);
    persist({ customColors: customColors.filter((c) => c.toLowerCase() !== color.toLowerCase()) });
  }

  function handleFontChange(id: string) {
    setFontId(id); // updates --font-app on <html> immediately
    persist({ fontId: id }); // fire-and-forget DB sync for other devices
  }

  const alreadySaved = isValidHexColor(customHex) && customColors.some((c) => c.toLowerCase() === customHex.toLowerCase());
  const isSwatchColor = ACCENT_COLORS.some((c) => c.toLowerCase() === customHex.toLowerCase());
  const atCustomLimit = customColors.length >= MAX_CUSTOM_COLORS;

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Appearance</h2>
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((option) => (
            <button
              key={option}
              onClick={() => handleThemeChange(option)}
              className={`flex-1 rounded-lg border px-4 py-2 text-sm font-medium capitalize ${SELECTION_CLASS[option]}`}>
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-1 text-sm font-semibold">Accent Color</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Pick a swatch or set any custom color — it applies across the whole dashboard.
        </p>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleAccentChange(color)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-white transition-transform hover:scale-105 dark:ring-offset-zinc-900"
              style={{
                backgroundColor: color,
                ...({ '--tw-ring-color': accent.toLowerCase() === color.toLowerCase() ? color : 'transparent' } as CSSProperties),
              }}
              aria-label={color}
              aria-pressed={accent.toLowerCase() === color.toLowerCase()}>
              {accent.toLowerCase() === color.toLowerCase() ? <Check className="size-4 text-white" strokeWidth={3} /> : null}
            </button>
          ))}
        </div>

        <div className="mt-4 flex items-center gap-3 border-t border-black/5 pt-4 dark:border-white/10">
          <label
            htmlFor="custom-accent-picker"
            className="relative flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-dashed border-zinc-300 dark:border-zinc-600"
            style={{ backgroundColor: isValidHexColor(customHex) ? customHex : undefined }}
            title="Pick a custom color">
            {!isValidHexColor(customHex) ? <Pipette className="size-4 text-zinc-400" /> : null}
            <input
              id="custom-accent-picker"
              type="color"
              value={isValidHexColor(customHex) ? customHex : accent}
              onChange={(e) => handleCustomHexInput(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Custom accent color picker"
            />
          </label>
          <div className="flex-1">
            <div className="flex max-w-[260px] items-center gap-2">
              <input
                type="text"
                value={customHex}
                onChange={(e) => handleCustomHexInput(e.target.value)}
                placeholder="#0F6E5B"
                maxLength={7}
                spellCheck={false}
                className={`w-full rounded-lg border px-3 py-1.5 text-sm outline-none ${
                  customHexError
                    ? 'border-red-400 text-red-600 focus:border-red-500'
                    : 'border-zinc-300 focus:border-[var(--accent)] dark:border-zinc-700'
                } dark:bg-zinc-800`}
              />
              <button
                type="button"
                onClick={handleSaveCustomColor}
                disabled={!isValidHexColor(customHex) || customHexError || isSwatchColor || alreadySaved || atCustomLimit}
                title={
                  atCustomLimit
                    ? `You can save up to ${MAX_CUSTOM_COLORS} custom colors`
                    : alreadySaved
                      ? 'Already saved'
                      : 'Save this color'
                }
                className="flex shrink-0 items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs font-medium text-zinc-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300">
                {justSaved ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
                {justSaved ? 'Saved' : 'Save'}
              </button>
            </div>
            {customHexError ? (
              <p className="mt-1 text-xs text-red-500">Enter a valid hex color, e.g. #0F6E5B.</p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                Any hex color works — this is your personal accent, not a barangay-wide setting.
              </p>
            )}
          </div>
        </div>

        {customColors.length ? (
          <div className="mt-4 border-t border-black/5 pt-4 dark:border-white/10">
            <p className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-500">
              <span>Saved colors</span>
              <span>
                {customColors.length}/{MAX_CUSTOM_COLORS}
              </span>
            </p>
            <div className="flex flex-wrap gap-3">
              {customColors.map((color) => (
                <div key={color} className="group relative">
                  <button
                    onClick={() => handleAccentChange(color)}
                    className="flex h-10 w-10 items-center justify-center rounded-full ring-2 ring-offset-2 ring-offset-white transition-transform hover:scale-105 dark:ring-offset-zinc-900"
                    style={{
                      backgroundColor: color,
                      ...({ '--tw-ring-color': accent.toLowerCase() === color.toLowerCase() ? color : 'transparent' } as CSSProperties),
                    }}
                    aria-label={color}
                    aria-pressed={accent.toLowerCase() === color.toLowerCase()}>
                    {accent.toLowerCase() === color.toLowerCase() ? <Check className="size-4 text-white" strokeWidth={3} /> : null}
                  </button>
                  <button
                    onClick={() => handleRemoveCustomColor(color)}
                    aria-label={`Remove saved color ${color}`}
                    className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-zinc-700 text-white opacity-0 transition-opacity group-hover:opacity-100 dark:bg-zinc-300 dark:text-zinc-900">
                    <X className="size-2.5" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-1 text-sm font-semibold">Font</h2>
        <p className="mb-3 text-xs text-zinc-500">Sets the typeface used across the whole dashboard.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {FONT_OPTIONS.map((option) => (
            <button
              key={option.id}
              onClick={() => handleFontChange(option.id)}
              aria-pressed={fontId === option.id}
              style={{ fontFamily: option.stack }}
              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                fontId === option.id
                  ? 'border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'border-zinc-300 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800'
              }`}>
              <span className="truncate">{option.label}</span>
              {fontId === option.id ? <Check className="size-3.5 shrink-0" strokeWidth={3} /> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Preview</h2>
        <div className="overflow-hidden rounded-lg border border-black/10 dark:border-white/10">
          {/* Mini "app chrome" mockup — sidebar item, top bar, buttons, and a badge — so the
              accent's and font's effect on real dashboard chrome is visible before it's saved. */}
          <div className="flex h-56" style={{ fontFamily: 'var(--font-app)' }}>
            <div className="flex w-14 flex-col items-center gap-3 border-r border-black/5 bg-zinc-50 py-4 dark:border-white/10 dark:bg-zinc-950">
              <div className="flex size-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: accent }}>
                <LayoutDashboard className="size-4" />
              </div>
              <div className="size-8 rounded-lg bg-zinc-200/60 dark:bg-zinc-800" />
              <div className="size-8 rounded-lg bg-zinc-200/60 dark:bg-zinc-800" />
            </div>
            <div className="flex flex-1 flex-col">
              <div className="flex items-center justify-between border-b border-black/5 px-4 py-2.5 dark:border-white/10">
                <div className="flex items-center gap-2 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-400 dark:bg-zinc-800">
                  <Search className="size-3" />
                  <span>Search</span>
                </div>
                <div className="relative">
                  <Bell className="size-4 text-zinc-400" />
                  <span
                    className="absolute -right-1 -top-1 flex size-3 items-center justify-center rounded-full text-[8px] font-bold text-white"
                    style={{ backgroundColor: accent }}>
                    2
                  </span>
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-center gap-2">
                  <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-white" style={{ backgroundColor: accent }}>
                    Active
                  </span>
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--accent-tint)', color: accent }}>
                    Pending
                  </span>
                </div>
                <div className="h-2 w-3/4 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="h-2 w-1/2 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                <div className="mt-auto flex gap-2">
                  <button
                    type="button"
                    tabIndex={-1}
                    className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ backgroundColor: accent }}>
                    Approve
                  </button>
                  <button
                    type="button"
                    tabIndex={-1}
                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold"
                    style={{ borderColor: accent, color: accent }}>
                    Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {saved ? (
        <p className="text-sm" style={{ color: accent }}>
          Saved.
        </p>
      ) : null}
    </div>
  );
}
