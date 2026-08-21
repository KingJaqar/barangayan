'use client';

/**
 * Theme form — reuses Phase 0's three controllers (useThemeController, useAccentController,
 * useFontController) and additionally persists the resident's choice to their profiles row
 * for cross-device sync. This is the Phase 7 companion to the pre-login personalization
 * page (Phase 1's (auth)/personalization/page.tsx).
 *
 * The admin-web Theme page targets the same three DB columns on the same profiles row —
 * changes here will reflect there on the next load (and vice versa). Cross-app parity
 * is a deliberate, checkable goal per §5 Parity Matrix.
 */

import { ACCENT_COLORS, FONT_OPTIONS } from '@barangayan/shared';
import { Check, Moon, Pipette, Plus, Sun, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { isValidHexColor, MAX_CUSTOM_COLORS, useAccentController } from '@/components/theme/accent-controller';
import { ColorPickerSwatch } from '@/components/theme/color-picker-popover';
import { useFontController } from '@/components/theme/font-controller';
import { useThemeController, type ResolvedTheme } from '@/components/theme/theme-controller';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

// ─── Section heading ─────────────────────────────────────────────────────────

function SectionHead({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-3 text-sm font-semibold">{children}</h3>;
}

// ─── Theme selector ──────────────────────────────────────────────────────────

const THEME_OPTIONS: { key: ResolvedTheme; label: string; Icon: React.ElementType }[] = [
  { key: 'light', label: 'Light', Icon: Sun },
  { key: 'dark', label: 'Dark', Icon: Moon },
];

function ThemeSelector({ value, onChange }: { value: ResolvedTheme; onChange: (t: ResolvedTheme) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {THEME_OPTIONS.map(({ key, label, Icon }) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => onChange(key)}
            className={`relative flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all ${
              active
                ? 'border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300'
            }`}>
            {active ? (
              <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--accent)] text-white">
                <Check size={10} strokeWidth={3} />
              </span>
            ) : null}
            <Icon size={22} />
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Accent swatch picker ─────────────────────────────────────────────────────

/** Shared swatch button — ring-based selection state (instead of an overlaid
 * checkmark) so it reads cleanly against any hue, light or dark. */
function Swatch({
  color,
  active,
  onSelect,
  onRemove,
}: {
  color: string;
  active: boolean;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <div className="group/swatch relative">
      <button
        type="button"
        onClick={onSelect}
        title={color}
        aria-label={`Use accent color ${color}`}
        aria-pressed={active}
        style={{ backgroundColor: color }}
        className={`relative h-10 w-10 rounded-full ring-1 ring-inset ring-black/10 transition-all duration-150 ease-out hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:ring-white/15 dark:focus-visible:ring-offset-zinc-900 ${
          active ? 'scale-110 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''
        }`}>
        {active ? <Check size={16} strokeWidth={3} className="absolute inset-0 m-auto text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.45)]" /> : null}
      </button>
      {onRemove ? (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          title={`Remove ${color}`}
          aria-label={`Remove ${color}`}
          className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 opacity-0 shadow-sm transition-opacity group-hover/swatch:opacity-100 hover:!text-red-500 focus-visible:opacity-100 focus-visible:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          <X size={10} strokeWidth={3} />
        </button>
      ) : null}
    </div>
  );
}

function AccentPicker({
  value,
  customColors,
  onSelect,
  onAddCustom,
  onRemoveCustom,
}: {
  value: string;
  customColors: string[];
  onSelect: (c: string) => void;
  onAddCustom: (c: string) => boolean;
  onRemoveCustom: (c: string) => void;
}) {
  const [pickerColor, setPickerColor] = useState('#1a2b3c');
  const [hexDraft, setHexDraft] = useState('#1a2b3c');
  const [hexError, setHexError] = useState('');
  const atMax = customColors.length >= MAX_CUSTOM_COLORS;

  function syncColor(next: string) {
    setPickerColor(next);
    setHexDraft(next);
    setHexError('');
  }

  function handleHexDraftChange(raw: string) {
    setHexDraft(raw);
    setHexError('');
    const normalized = raw.trim().startsWith('#') ? raw.trim() : `#${raw.trim()}`;
    if (isValidHexColor(normalized)) setPickerColor(normalized);
  }

  function handleAddCustom() {
    const normalized = hexDraft.trim().startsWith('#') ? hexDraft.trim() : `#${hexDraft.trim()}`;
    if (!isValidHexColor(normalized)) {
      setHexError('Enter a valid 6-digit hex color (e.g. #1a2b3c).');
      return;
    }
    const added = onAddCustom(normalized);
    if (!added) {
      setHexError(atMax ? `You can save up to ${MAX_CUSTOM_COLORS} custom colors. Remove one first.` : 'Color already saved.');
      return;
    }
    onSelect(normalized);
    setHexError('');
  }

  return (
    <div className="space-y-5">
      {/* Preset swatches */}
      <div>
        <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Presets</p>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map((color) => (
            <Swatch key={color} color={color} active={value.toLowerCase() === color.toLowerCase()} onSelect={() => onSelect(color)} />
          ))}
        </div>
      </div>

      {/* Custom colors */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Your colors</p>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {customColors.length}/{MAX_CUSTOM_COLORS}
          </span>
        </div>
        {customColors.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {customColors.map((color) => (
              <Swatch
                key={color}
                color={color}
                active={value.toLowerCase() === color.toLowerCase()}
                onSelect={() => onSelect(color)}
                onRemove={() => onRemoveCustom(color)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-zinc-200 px-3.5 py-3 text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
            <Pipette size={14} className="shrink-0" />
            Colors you save below will show up here.
          </div>
        )}
      </div>

      {/* Custom color picker */}
      <div>
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-3.5 dark:border-zinc-700 dark:bg-zinc-800/40 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <ColorPickerSwatch color={pickerColor} onChange={syncColor} size={44} />
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-400 dark:text-zinc-500">New color</p>
              <div className="mt-0.5 flex items-center">
                <span className="font-mono text-sm text-zinc-400 dark:text-zinc-500">#</span>
                <input
                  value={hexDraft.replace(/^#/, '')}
                  onChange={(e) => handleHexDraftChange(e.target.value)}
                  spellCheck={false}
                  maxLength={6}
                  aria-label="Custom accent color hex code"
                  className="w-20 min-w-0 bg-transparent font-mono text-sm font-semibold uppercase tracking-wide text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
                  placeholder="1A2B3C"
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddCustom}
            disabled={atMax}
            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40">
            <Plus size={15} strokeWidth={2.5} />
            Save color
          </button>
        </div>
        {hexError ? <p className="mt-1.5 text-xs text-red-500">{hexError}</p> : null}
      </div>
    </div>
  );
}

// ─── Font picker ──────────────────────────────────────────────────────────────

function FontPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FONT_OPTIONS.map((font) => {
        const active = value === font.id;
        return (
          <button
            key={font.id}
            type="button"
            onClick={() => onChange(font.id)}
            style={{ fontFamily: font.stack }}
            className={`rounded-full border px-4 py-1.5 text-sm transition-all ${
              active
                ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                : 'border-zinc-200 bg-zinc-50 text-zinc-700 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
            }`}>
            {font.label}
          </button>
        );
      })}
    </div>
  );
}

// ─── Main form ────────────────────────────────────────────────────────────────

export function ThemeForm({
  userId,
  savedTheme,
  savedAccent,
  savedFont,
}: {
  userId: string;
  savedTheme: 'light' | 'dark' | null;
  savedAccent: string | null;
  savedFont: string | null;
}) {
  const { theme, setTheme } = useThemeController();
  const { accent, setAccent, customColors, addCustomColor, removeCustomColor } = useAccentController();
  const { fontId, setFontId } = useFontController();

  // On mount, reconcile DB-saved preferences with localStorage. If this is the resident's
  // first visit on this device (no localStorage entry yet), apply the DB value. If they've
  // already made a local choice, the local one wins — the DB is a cross-device sync
  // fallback, not an override of the live local choice.
  const reconciled = useRef(false);
  useEffect(() => {
    if (reconciled.current) return;
    reconciled.current = true;
    try {
      if (savedTheme && !localStorage.getItem('barangayan-resident-web-theme')) setTheme(savedTheme);
      if (savedAccent && isValidHexColor(savedAccent) && !localStorage.getItem('barangayan-resident-web-accent')) setAccent(savedAccent);
      if (savedFont && !localStorage.getItem('barangayan-resident-web-font')) setFontId(savedFont);
    } catch {
      // Private browsing / storage disabled — local controllers already have live values.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persistToDb(update: { theme_preference?: string; accent_color?: string; font_preference?: string }) {
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from('profiles').update(update).eq('id', userId);
    if (error) toast.error(`Could not save preference: ${error.message}`);
  }

  function handleThemeChange(next: ResolvedTheme) {
    setTheme(next);
    persistToDb({ theme_preference: next });
  }

  function handleAccentChange(color: string) {
    setAccent(color);
    persistToDb({ accent_color: color });
  }

  function handleFontChange(id: string) {
    setFontId(id);
    persistToDb({ font_preference: id });
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* Color scheme */}
      <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900">
        <SectionHead>Color Scheme</SectionHead>
        <ThemeSelector value={theme} onChange={handleThemeChange} />
      </div>

      {/* Font */}
      <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900">
        <SectionHead>Font Style</SectionHead>
        <FontPicker value={fontId} onChange={handleFontChange} />
      </div>

      {/* Accent color */}
      <div className="rounded-xl border border-black/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900 lg:col-span-2">
        <SectionHead>Accent Color</SectionHead>
        <AccentPicker
          value={accent}
          customColors={customColors}
          onSelect={handleAccentChange}
          onAddCustom={(color) => {
            const added = addCustomColor(color);
            if (added) persistToDb({ accent_color: color });
            return added;
          }}
          onRemoveCustom={removeCustomColor}
        />
      </div>

      {/* Live preview — a small mock UI card so residents see their theme, accent, and
          font working together the way they actually will in the app, instead of a flat
          tinted box with a caption. */}
      <LivePreview fontStack={FONT_OPTIONS.find((f) => f.id === fontId)?.stack} />
    </div>
  );
}

function LivePreview({ fontStack }: { fontStack: string | undefined }) {
  return (
    <div className="lg:col-span-2">
      <div className="mb-2.5 flex items-center gap-1.5">
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--accent)] opacity-75" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Preview</p>
      </div>

      <div
        aria-hidden="true"
        className="overflow-hidden rounded-2xl border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900">
        <div className="h-1.5 w-full bg-[linear-gradient(90deg,var(--accent),var(--accent-strong))]" />
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent)', fontFamily: fontStack }}>
              B
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="font-bold leading-tight" style={{ fontFamily: fontStack }}>
                Barangayan
              </p>
              <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">This is how text, buttons, and accents will look</p>
            </div>
            <span className="shrink-0 rounded-full bg-[var(--accent-tint)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">New</span>
          </div>

          <p className="mt-3.5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300" style={{ fontFamily: fontStack }}>
            The quick brown fox jumps over the lazy dog.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span
              className="rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm"
              style={{ backgroundColor: 'var(--accent)', fontFamily: fontStack }}>
              Primary action
            </span>
            <span
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', fontFamily: fontStack }}>
              Secondary
            </span>
          </div>
        </div>
      </div>

      <p className="mt-2 px-1 text-xs text-zinc-500 dark:text-zinc-400">Changes apply immediately and sync across your devices.</p>
    </div>
  );
}
