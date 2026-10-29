import { useFloatingTabClearance } from './use-floating-tab-layout';

/**
 * Shared visibility and scroll clearance for the bottom tabs.
 * Section subtabs use the same pathname; detail and form routes get no bar.
 * Includes the measured bar, 12dp bottom offset, top gap and Android safe area.
 */
export function useFloatingTabInset(ignoreMapHide = false) {
  return useFloatingTabClearance(ignoreMapHide);
}
