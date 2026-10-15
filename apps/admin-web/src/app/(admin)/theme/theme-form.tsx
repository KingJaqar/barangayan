'use client';

import { ACCENT_COLORS, FONT_OPTIONS } from '@barangayan/shared';
import { Check, Moon, Palette, Pipette, Plus, Sun, Type, X } from 'lucide-react';
import { useEffect, useRef, useState, type CSSProperties } from 'react';

import { hasStoredAccent, isValidHexColor, MAX_CUSTOM_COLORS, useAccentController } from '@/components/ui/accent-controller';
import { hasStoredFont, useFontController } from '@/components/ui/font-controller';
import { hasStoredTheme, useThemeController } from '@/components/ui/theme-controller';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

import styles from './theme.module.css';

interface ThemeFormProps {
  initialTheme: 'light' | 'dark' | 'system';
  initialAccentColor: string;
  initialCustomColors: string[];
  initialFontId: string;
}

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
    <div className={styles.layout}>
      <div className={styles.controls}>
        <section className={styles.panel} aria-labelledby="appearance-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}><Sun size={17} aria-hidden="true" /></span>
            <div><h2 id="appearance-heading">Appearance</h2><p>Find your preferred point of view.</p></div>
          </div>
          <div className={styles.appearanceOptions}>
            {(['light', 'dark'] as const).map((option) => (
              <button key={option} type="button" onClick={() => handleThemeChange(option)}
                aria-pressed={theme === option} suppressHydrationWarning
                className={`${styles.appearanceOption} ${option === 'light' ? styles.lightOption : styles.darkOption}`}>
                <span className={`${styles.miniWindow} ${option === 'dark' ? styles.miniDark : styles.miniLight}`} aria-hidden="true">
                  <span className={styles.miniSidebar}><i /><i /><i /></span>
                  <span className={styles.miniContent}><span /><span /><span /><b style={{ backgroundColor: accent }} /></span>
                </span>
                <span className={styles.optionLabel}>
                  <span>{option === 'light' ? <Sun size={15} /> : <Moon size={15} />}{option === 'light' ? 'Light' : 'Dark'}</span>
                  <span className={styles.selectionIndicator}><Check size={12} strokeWidth={3} /></span>
                </span>
              </button>
            ))}
          </div>
          <p className={styles.hint}>Choose a lighter workspace or a softer look after hours.</p>
        </section>

        <section className={styles.panel} aria-labelledby="accent-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}><Palette size={17} aria-hidden="true" /></span>
            <div><h2 id="accent-heading">Accent color</h2><p>A little color. A lot of personality.</p></div>
            <span className={styles.hexBadge}>{accent.toUpperCase()}</span>
          </div>
          <div className={styles.swatches}>
            {ACCENT_COLORS.map((color) => (
              <button key={color} type="button" onClick={() => handleAccentChange(color)}
                className={styles.swatch} title={color.toUpperCase()}
                style={{ '--swatch': color } as CSSProperties}
                aria-label={`Use accent ${color}`} aria-pressed={accent.toLowerCase() === color.toLowerCase()}>
                {accent.toLowerCase() === color.toLowerCase() ? <Check size={16} strokeWidth={3} /> : null}
              </button>
            ))}
          </div>
          <div className={styles.customColor}>
            <label htmlFor="custom-accent-picker" className={styles.colorPicker} title="Pick a custom color"
              style={{ backgroundColor: isValidHexColor(customHex) ? customHex : undefined }}>
              <Pipette size={16} aria-hidden="true" />
              <input id="custom-accent-picker" type="color" value={isValidHexColor(customHex) ? customHex : accent}
                onChange={(e) => handleCustomHexInput(e.target.value)} aria-label="Custom accent color picker" />
            </label>
            <div className={styles.hexField}>
              <label htmlFor="custom-accent-hex">Custom color</label>
              <input id="custom-accent-hex" type="text" value={customHex} onChange={(e) => handleCustomHexInput(e.target.value)}
                placeholder="#0F6E5B" maxLength={7} spellCheck={false} aria-invalid={customHexError}
                aria-describedby="custom-accent-help" />
            </div>
            <button type="button" onClick={handleSaveCustomColor}
              disabled={!isValidHexColor(customHex) || customHexError || isSwatchColor || alreadySaved || atCustomLimit}
              title={atCustomLimit ? `You can save up to ${MAX_CUSTOM_COLORS} custom colors` : alreadySaved ? 'Already saved' : 'Save this color'}
              className={styles.saveColor}>
              {justSaved ? <Check size={14} /> : <Plus size={14} />}{justSaved ? 'Saved' : 'Save color'}
            </button>
          </div>
          <p id="custom-accent-help" className={customHexError ? styles.error : styles.hint}>
            {customHexError ? 'Enter a valid hex color, e.g. #0F6E5B.' : 'Pick any hex color to make this workspace yours.'}
          </p>
          <div className={styles.savedColors}>
            <div className={styles.subheading}><span>Saved colors</span><span>{customColors.length} / {MAX_CUSTOM_COLORS}</span></div>
            {customColors.length ? (
              <div className={styles.swatches}>
                {customColors.map((color) => (
                  <div key={color} className={styles.savedSwatch}>
                    <button type="button" onClick={() => handleAccentChange(color)} className={styles.swatch}
                      style={{ '--swatch': color } as CSSProperties} title={color.toUpperCase()}
                      aria-label={`Use saved accent ${color}`} aria-pressed={accent.toLowerCase() === color.toLowerCase()}>
                      {accent.toLowerCase() === color.toLowerCase() ? <Check size={16} strokeWidth={3} /> : null}
                    </button>
                    <button type="button" onClick={() => handleRemoveCustomColor(color)} aria-label={`Remove saved color ${color}`} className={styles.removeColor}>
                      <X size={11} strokeWidth={3} />
                    </button>
                  </div>
                ))}
              </div>
            ) : <p className={styles.hint}>Your favorite custom colors will appear here.</p>}
          </div>
        </section>

      </div>

      <div className={styles.typographyColumn}>
        <section className={styles.panel} aria-labelledby="font-heading">
          <div className={styles.sectionHeading}>
            <span className={styles.sectionIcon}><Type size={17} aria-hidden="true" /></span>
            <div><h2 id="font-heading">Typography</h2><p>Give every word your own style.</p></div>
          </div>
          <div className={styles.fontOptions}>
            {FONT_OPTIONS.map((option) => (
              <button key={option.id} type="button" onClick={() => handleFontChange(option.id)} aria-pressed={fontId === option.id}
                style={{ fontFamily: option.stack }} className={styles.fontOption}>
                <span className={styles.fontSample} aria-hidden="true">Aa</span>
                <span>{option.label}</span>
                {fontId === option.id ? <Check size={14} strokeWidth={2.5} /> : null}
              </button>
            ))}
          </div>
        </section>
        <div className={styles.personalNote}><span className={styles.noteIcon}><Palette size={16} /></span><div><h3>Make yourself at home.</h3><p>These settings are personal to your account and apply across your admin dashboard.</p></div></div>
        <p className={styles.status} role="status" aria-live="polite">{saved ? <><Check size={14} /> Preferences saved</> : 'Changes apply instantly'}</p>
      </div>
    </div>
  );
}
