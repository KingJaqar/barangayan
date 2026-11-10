/**
 * Android runs every WebView of the app in one shared renderer process, which the system kills
 * to reclaim memory while the app is in the background. react-native-webview then keeps the
 * dead WebView on screen (it only avoids the crash), and Android requires the app to replace
 * it: a dead WebView shows its last frame and ignores touches, so the map looks frozen.
 */

/** Renderer deaths within this window count toward giving up. */
export const RENDERER_DEATH_WINDOW_MS = 60_000;
/** The third death within the window stops automatic recreation (a page that keeps crashing). */
export const RENDERER_DEATH_LIMIT = 3;
/** A map whose screen is not focused keeps its WebView this long, so quick tab switches stay instant. */
export const MAP_RELEASE_GRACE_MS = 60_000;

export type RendererRecoveryDecision = 'recreate' | 'give-up';

/** Decides whether a map whose renderer died is recreated automatically or reports an error. */
export class MapRendererRecovery {
  private deaths: number[] = [];

  record(now: number): RendererRecoveryDecision {
    this.deaths = [...this.deaths.filter(at => now - at < RENDERER_DEATH_WINDOW_MS), now];
    return this.deaths.length >= RENDERER_DEATH_LIMIT ? 'give-up' : 'recreate';
  }
}

/**
 * Whether a map keeps its WebView. A hidden screen's map is released after the grace period,
 * or at once when the app goes to the background (timers do not run there, and that is when
 * Android reclaims memory). The focused screen's map is always kept.
 */
export function mapRetained({ focused, foreground, graceExpired }: { focused: boolean; foreground: boolean; graceExpired: boolean }) {
  return focused || (foreground && !graceExpired);
}
