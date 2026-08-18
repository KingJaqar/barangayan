/**
 * Web admin Theme page's font picker. Unlike ACCENT_COLORS these are not user-typable
 * custom values — the admin picks one of these IDs, which is persisted verbatim to
 * `profiles.font_preference` (0075 migration) and mapped to its CSS `font-family` stack on
 * render. Deliberately system/web-safe font stacks (no next/font/google download) so the
 * choice applies instantly with no extra network request or flash of fallback text.
 */
export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family value, most-preferred face first. */
  stack: string;
}

export const FONT_OPTIONS: readonly FontOption[] = [
  { id: 'system', label: 'System Default', stack: 'system-ui, Arial, Helvetica, sans-serif' },
  { id: 'inter', label: 'Inter', stack: '"Inter", system-ui, Arial, sans-serif' },
  { id: 'arial', label: 'Arial', stack: 'Arial, Helvetica, sans-serif' },
  { id: 'helvetica', label: 'Helvetica', stack: '"Helvetica Neue", Helvetica, Arial, sans-serif' },
  { id: 'segoe-ui', label: 'Segoe UI', stack: '"Segoe UI", Tahoma, Geneva, sans-serif' },
  { id: 'verdana', label: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
  { id: 'tahoma', label: 'Tahoma', stack: 'Tahoma, Geneva, sans-serif' },
  { id: 'trebuchet-ms', label: 'Trebuchet MS', stack: '"Trebuchet MS", sans-serif' },
  { id: 'georgia', label: 'Georgia', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'times-new-roman', label: 'Times New Roman', stack: '"Times New Roman", Times, serif' },
  { id: 'garamond', label: 'Garamond', stack: 'Garamond, Georgia, serif' },
  { id: 'courier-new', label: 'Courier New', stack: '"Courier New", Courier, monospace' },
] as const;

export const DEFAULT_FONT_ID = FONT_OPTIONS[0].id;

export function getFontStack(id: string): string {
  return FONT_OPTIONS.find((f) => f.id === id)?.stack ?? FONT_OPTIONS[0].stack;
}

export function isValidFontId(id: string): boolean {
  return FONT_OPTIONS.some((f) => f.id === id);
}
