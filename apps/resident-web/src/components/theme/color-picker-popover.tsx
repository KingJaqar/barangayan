'use client';

/**
 * Self-contained HSV color picker — a custom-built replacement for the browser's native
 * `<input type="color">` popup (which can't be restyled; it's OS-drawn, same as a <select>
 * dropdown or <input type="date"> calendar). Renders its own saturation/value square, hue
 * slider, optional EyeDropper-API screen picker, and RGB fields inside an app-styled panel
 * anchored above the trigger swatch (the trigger tends to sit low in its card, so opening
 * upward keeps the panel from spilling past the viewport bottom).
 */

import { Pipette } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

// ─── color math ────────────────────────────────────────────────────────────

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const int = parseInt(hex.replace('#', ''), 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  s /= 100;
  v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let [r, g, b] = [0, 0, 0];
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
}

function hexToHsv(hex: string): { h: number; s: number; v: number } {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

declare global {
  interface Window {
    /** Chromium's screen-color-picking API. Feature-detected — no polyfill available. */
    EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
  }
}

// ─── component ─────────────────────────────────────────────────────────────

export function ColorPickerSwatch({
  color,
  onChange,
  size = 44,
  className = '',
}: {
  /** Current color as a 6-digit hex string, e.g. "#1A2B3C". */
  color: string;
  /** Fires continuously while dragging/typing — always a normalized uppercase hex string. */
  onChange: (hex: string) => void;
  size?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title="Choose a color"
        aria-haspopup="dialog"
        aria-expanded={open}
        style={{ backgroundColor: color, width: size, height: size }}
        className={`group relative shrink-0 overflow-hidden rounded-full ring-1 ring-inset ring-black/10 shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 dark:ring-white/15 ${className}`}>
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-opacity group-hover:bg-black/20 group-hover:opacity-100">
          <Pipette size={16} className="text-white drop-shadow" />
        </span>
      </button>

      {/* Mounted fresh each time the panel opens, so its HSV state can be lazily seeded
          from `color` at construction time instead of re-syncing via an effect (which would
          fight the hex<->hsv round trip's rounding and jitter the hue while dragging). */}
      {open ? <ColorPickerPanel initialColor={color} onChange={onChange} /> : null}
    </div>
  );
}

function ColorPickerPanel({ initialColor, onChange }: { initialColor: string; onChange: (hex: string) => void }) {
  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  const [{ h: hue, s: sat, v: val }, setHsv] = useState(() => hexToHsv(initialColor));

  const rgb = hsvToRgb(hue, sat, val);
  const rounded = { r: Math.round(rgb.r), g: Math.round(rgb.g), b: Math.round(rgb.b) };
  const previewHex = rgbToHex(rounded.r, rounded.g, rounded.b);

  function applyHsv(nextHue: number, nextSat: number, nextVal: number) {
    setHsv({ h: nextHue, s: nextSat, v: nextVal });
    const c = hsvToRgb(nextHue, nextSat, nextVal);
    onChange(rgbToHex(c.r, c.g, c.b));
  }

  function handleSVPointer(e: React.PointerEvent) {
    const rect = svRef.current!.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const y = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    applyHsv(hue, x * 100, (1 - y) * 100);
  }

  function handleHuePointer(e: React.PointerEvent) {
    const rect = hueRef.current!.getBoundingClientRect();
    const x = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    applyHsv(x * 360, sat, val);
  }

  function handleRgbChange(channel: 'r' | 'g' | 'b', raw: string) {
    const n = clamp(parseInt(raw, 10) || 0, 0, 255);
    const next = { ...rounded, [channel]: n };
    const hsv = rgbToHsv(next.r, next.g, next.b);
    // Achromatic (gray) input has no defined hue — keep the slider where it was instead
    // of snapping to red, so the hue thumb doesn't jump when a user types e.g. "128" into R/G/B.
    applyHsv(hsv.s === 0 ? hue : hsv.h, hsv.s, hsv.v);
  }

  const eyeDropperSupported = typeof window !== 'undefined' && !!window.EyeDropper;

  async function handleEyedropper() {
    if (!window.EyeDropper) return;
    try {
      const result = await new window.EyeDropper().open();
      const hsv = hexToHsv(result.sRGBHex);
      applyHsv(hsv.h, hsv.s, hsv.v);
    } catch {
      // User cancelled the screen pick — no-op.
    }
  }

  return (
    <div
      role="dialog"
      aria-label="Color picker"
      className="absolute bottom-[calc(100%+0.5rem)] left-0 z-30 w-64 rounded-2xl border border-zinc-200 bg-white p-3 shadow-xl shadow-black/10 dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/40">
      {/* Saturation / value field */}
      <div
        ref={svRef}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleSVPointer(e);
        }}
        onPointerMove={(e) => {
          if (e.buttons === 1) handleSVPointer(e);
        }}
        className="relative h-36 w-full touch-none select-none rounded-xl"
        style={{
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
          backgroundImage:
            'linear-gradient(to top, #000, rgba(0,0,0,0)), linear-gradient(to right, #fff, rgba(255,255,255,0))',
        }}>
        <div
          className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.4)]"
          style={{ left: `${sat}%`, top: `${100 - val}%`, backgroundColor: previewHex }}
        />
      </div>

      {/* Eyedropper + preview + hue slider */}
      <div className="mt-3 flex items-center gap-2.5">
        <button
          type="button"
          onClick={handleEyedropper}
          disabled={!eyeDropperSupported}
          title={eyeDropperSupported ? 'Pick a color from your screen' : 'Screen picker not supported in this browser'}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800">
          <Pipette size={14} />
        </button>
        <span
          className="h-8 w-8 shrink-0 rounded-full ring-1 ring-inset ring-black/10 dark:ring-white/15"
          style={{ backgroundColor: previewHex }}
        />
        <div
          ref={hueRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            handleHuePointer(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) handleHuePointer(e);
          }}
          className="relative h-3 flex-1 touch-none select-none rounded-full"
          style={{ background: 'linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)' }}>
          <div
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3),0_1px_3px_rgba(0,0,0,0.4)]"
            style={{ left: `${(hue / 360) * 100}%`, backgroundColor: `hsl(${hue}, 100%, 50%)` }}
          />
        </div>
      </div>

      {/* RGB fields */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(['r', 'g', 'b'] as const).map((channel) => (
          <label key={channel} className="flex flex-col items-center gap-1">
            <input
              value={rounded[channel]}
              onChange={(e) => handleRgbChange(channel, e.target.value.replace(/\D/g, '').slice(0, 3))}
              inputMode="numeric"
              aria-label={channel.toUpperCase()}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-1.5 py-1.5 text-center text-sm font-medium tabular-nums outline-none focus:border-[var(--accent)] focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:focus:bg-zinc-900"
            />
            <span className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">{channel}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
