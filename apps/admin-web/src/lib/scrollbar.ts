/**
 * Thin, theme-aware scrollbar — zinc-300 thumb on light, zinc-700 on dark,
 * transparent track either way, so it blends into whatever surface it's on
 * instead of showing the browser/OS default scrollbar. Firefox gets it via
 * `scrollbar-color`/`scrollbar-width`; Chromium/WebKit via the `::-webkit-*`
 * pseudo-elements. Shared by the notification bell popover, the notifications
 * drawer's list, and its detail panel so all three stay visually consistent.
 */
export const THEMED_SCROLLBAR_CLASS =
  '[scrollbar-color:theme(colors.zinc.300)_transparent] [scrollbar-width:thin] dark:[scrollbar-color:theme(colors.zinc.700)_transparent] ' +
  '[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-zinc-300 [&::-webkit-scrollbar-thumb:hover]:bg-zinc-400 ' +
  '[&::-webkit-scrollbar-track]:bg-transparent dark:[&::-webkit-scrollbar-thumb]:bg-zinc-700 dark:[&::-webkit-scrollbar-thumb:hover]:bg-zinc-600';
