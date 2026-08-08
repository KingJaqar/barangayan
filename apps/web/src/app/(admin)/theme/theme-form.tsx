'use client';

import { ACCENT_COLORS } from '@barangayan/shared';
import { useEffect, useState } from 'react';

import { useThemeController } from '@/components/ui/theme-controller';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

interface ThemeFormProps {
  initialTheme: 'light' | 'dark' | 'system';
  initialAccentColor: string;
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
    'border-[#0F6E5B] bg-[#0F6E5B]/10 text-[#0F6E5B] dark:border-zinc-700 dark:bg-transparent dark:text-zinc-300',
  // Deselected in light mode, selected in dark mode.
  dark: 'border-zinc-300 bg-transparent text-zinc-600 dark:border-[#0F6E5B] dark:bg-[#0F6E5B]/10 dark:text-[#0F6E5B]',
} as const;

export function ThemeForm({ initialTheme, initialAccentColor }: ThemeFormProps) {
  const { theme, setTheme } = useThemeController();
  const [accentColor, setAccentColor] = useState(initialAccentColor);
  const [saved, setSaved] = useState(false);

  // One-time cross-device sync: if this browser's local theme differs from what's
  // stored in profiles.theme_preference (e.g. it was last changed on another device),
  // adopt the DB value once on mount rather than silently overwriting it.
  useEffect(() => {
    if ((initialTheme === 'light' || initialTheme === 'dark') && initialTheme !== theme) {
      setTheme(initialTheme);
    }
    // Only ever run this reconciliation once, on mount — not every time `theme` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function persist(next: { theme?: 'light' | 'dark'; accentColor?: string }) {
    setSaved(false);
    const supabase = createSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('profiles')
      .update({
        theme_preference: next.theme ?? theme,
        accent_color: next.accentColor ?? accentColor,
      })
      .eq('id', user.id);
    setSaved(true);
  }

  function handleThemeChange(option: 'light' | 'dark') {
    setTheme(option); // flips the .dark class on <html> immediately — the actual fix
    persist({ theme: option }); // fire-and-forget DB sync for other devices
  }

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
        <h2 className="mb-3 text-sm font-semibold">Accent Color</h2>
        <div className="flex gap-3">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => {
                setAccentColor(color);
                persist({ accentColor: color });
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: color }}
              aria-label={color}>
              {accentColor === color ? <span className="text-white">✓</span> : null}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-black/10 bg-white p-5 dark:border-white/10 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold">Preview</h2>
        <div
          className="flex w-fit items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: accentColor }}>
          <span>⊞</span>
          <span>Dashboard</span>
        </div>
      </div>

      {saved ? <p className="text-sm text-[#0F6E5B]">Saved.</p> : null}
    </div>
  );
}
