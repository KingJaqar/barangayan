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
import { Check, Moon, Sun } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useAccentController, isValidHexColor, MAX_CUSTOM_COLORS } from '@/components/theme/accent-controller';
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
            className={`flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-medium transition-all ${
              active
                ? 'border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--accent)]'
                : 'border-zinc-200 bg-zinc-50 text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300'
            }`}>
            <Icon size={22} />
            {label}
            {active ? <Check size={14} className="absolute" /> : null}
          </button>
        );
      })}
    </div>
  );
}

// ─── Accent swatch picker ─────────────────────────────────────────────────────

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
  const [hex, setHex] = useState('');
  const [hexError, setHexError] = useState('');

  function handleAddCustom() {
    const normalized = hex.trim().startsWith('#') ? hex.trim() : `#${hex.trim()}`;
    if (!isValidHexColor(normalized)) {
      setHexError('Enter a valid 6-digit hex color (e.g. #1a2b3c).');
      return;
    }
    const added = onAddCustom(normalized);
    if (!added) {
      if (customColors.length >= MAX_CUSTOM_COLORS) {
        setHexError(`You can save up to ${MAX_CUSTOM_COLORS} custom colors. Remove one first.`);
      } else {
        setHexError('Color already saved.');
      }
      return;
    }
    onSelect(normalized);
    setHex('');
    setHexError('');
  }

  return (
    <div className="space-y-3">
      {/* Preset swatches */}
      <div className="flex flex-wrap gap-2.5">
        {ACCENT_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onSelect(color)}
            title={color}
            style={{ backgroundColor: color }}
            className="relative h-9 w-9 rounded-full transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
            {value.toLowerCase() === color.toLowerCase() ? (
              <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow" />
            ) : null}
          </button>
        ))}
      </div>

      {/* Custom colors */}
      {customColors.length > 0 ? (
        <>
          <p className="text-xs font-medium text-zinc-500">Custom colors</p>
          <div className="flex flex-wrap gap-2.5">
            {customColors.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onSelect(color)}
                onContextMenu={(e) => { e.preventDefault(); if (window.confirm(`Remove ${color}?`)) onRemoveCustom(color); }}
                title={`${color} (right-click to remove)`}
                style={{ backgroundColor: color }}
                className="relative h-9 w-9 rounded-full transition-transform hover:scale-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]">
                {value.toLowerCase() === color.toLowerCase() ? (
                  <Check size={16} className="absolute inset-0 m-auto text-white drop-shadow" />
                ) : null}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {/* Add custom hex */}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <div className="flex gap-2">
            <input
              value={hex}
              onChange={(e) => { setHex(e.target.value); setHexError(''); }}
              placeholder="#1a2b3c"
              maxLength={7}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm font-mono outline-none focus:border-[var(--accent)] dark:border-zinc-700 dark:bg-zinc-800"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!hex.trim()}
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-medium transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800">
              Add
            </button>
          </div>
          {hexError ? <p className="mt-1 text-xs text-red-500">{hexError}</p> : null}
        </div>
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

      {/* Live preview */}
      <div className="rounded-xl border border-[var(--accent)]/30 bg-[var(--accent-tint)] p-4 lg:col-span-2">
        <p className="mb-1 text-sm font-semibold text-[var(--accent)]">Preview</p>
        <p className="text-base" style={{ fontFamily: FONT_OPTIONS.find((f) => f.id === fontId)?.stack }}>
          The quick brown fox jumps over the lazy dog. — Barangayan
        </p>
        <p className="mt-2 text-xs text-zinc-500">Changes apply immediately. Preferences are saved to your account for cross-device sync.</p>
      </div>
    </div>
  );
}
