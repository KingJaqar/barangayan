'use client';

import { useEffect, useRef, useState } from 'react';

/** Matches the SLIDE_TRANSITION duration used by every consumer of this hook
 * (drawer + detail panel) — kept slightly above the 380ms CSS duration so the
 * real `transitionend` always wins the race under normal motion. */
const EXIT_FALLBACK_MS = 450;

/**
 * Keeps a component mounted long enough to play a CSS exit transition before
 * disappearing, instead of vanishing the instant its parent stops rendering
 * it. `active` is the target open/closed state; `onExited` fires once the
 * exit has actually finished (parent may now unmount / clear selection).
 *
 * - `rendered`: whether the component should still be in the DOM at all.
 * - `visible`: the flag to drive the actual transition classes — starts
 *   `false`, flips to `true` one animation frame after mount (so the browser
 *   has committed the initial "closed" styles first and the transition to
 *   "open" actually animates instead of snapping), and flips back to `false`
 *   the instant `active` goes false to kick off the exit transition.
 * - `onTransitionEnd`: wire directly to the animated element's
 *   `onTransitionEnd`. Guards against the exit-completion logic firing for
 *   unrelated transitions elsewhere in the subtree, or firing on the enter
 *   transition (only unmounts when the exit transition — `active === false`
 *   — is the one that just finished).
 *
 * `transitionend` is the primary way the exit completes, but it is not
 * guaranteed to fire: consumers apply `motion-reduce:transition-none` for
 * `prefers-reduced-motion`, which drops the CSS transition (and so the
 * `transitionend` event) entirely, and a browser can also just fail to
 * deliver the event (tab backgrounded mid-animation, transition interrupted,
 * etc). Without a fallback, `rendered` gets stuck `true` forever in those
 * cases — for a full-screen dialog like the notifications drawer, that
 * leaves an invisible `fixed inset-0` backdrop mounted and eating every
 * click, i.e. the whole app looks frozen. A timeout matching the transition
 * duration guarantees the exit always completes.
 */
export function useMountTransition(active: boolean, onExited?: () => void) {
  const [rendered, setRendered] = useState(active);
  const [visible, setVisible] = useState(false);
  const rafRef = useRef<number | null>(null);
  const exitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitedRef = useRef(false);
  // Kept fresh after callback changes so the timeout fallback (scheduled
  // potentially several renders ago) calls the latest `onExited` rather
  // than one captured from a stale closure.
  const onExitedRef = useRef(onExited);

  useEffect(() => {
    onExitedRef.current = onExited;
  }, [onExited]);

  function finishExit() {
    if (exitedRef.current) return;
    exitedRef.current = true;
    setRendered(false);
    onExitedRef.current?.();
  }

  useEffect(() => {
    if (active) {
      exitedRef.current = false;
      // Re-mounting for a fresh open — flip back into the DOM immediately,
      // then flip `visible` on the next frame so the browser commits the
      // "closed" starting styles first and the transition actually animates.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRendered(true);
      rafRef.current = requestAnimationFrame(() => setVisible(true));
    } else {
      // `active` just went false — start the exit transition. `rendered`
      // normally flips false once `onTransitionEnd` below observes the exit
      // transition finish; the timeout is a safety net in case that event
      // never arrives (see doc comment above).
      setVisible(false);
      exitTimeoutRef.current = setTimeout(finishExit, EXIT_FALLBACK_MS);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (exitTimeoutRef.current !== null) clearTimeout(exitTimeoutRef.current);
    };
  }, [active]);

  function onTransitionEnd(event: { propertyName: string; target?: unknown; currentTarget?: unknown }) {
    // Ignore transitions bubbling up from descendants — only the exit
    // transition of the element this handler is wired to should unmount.
    if (event.target !== event.currentTarget) return;
    if (event.propertyName !== 'transform' && event.propertyName !== 'opacity') return;
    if (!active) {
      if (exitTimeoutRef.current !== null) {
        clearTimeout(exitTimeoutRef.current);
        exitTimeoutRef.current = null;
      }
      finishExit();
    }
  }

  return { rendered, visible, onTransitionEnd };
}
