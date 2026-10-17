/** Vertical drag (points) needed to flip the DRRM panel, and the flick speed that flips it from a short drag. */
const DRAG_THRESHOLD = 60;
const FLICK_VELOCITY = 0.5;

/** Where a released drag settles: true collapses the panel. */
export function settlesCollapsed(wasCollapsed: boolean, dy: number, vy: number): boolean {
  return wasCollapsed ? dy > -DRAG_THRESHOLD : dy > DRAG_THRESHOLD || vy > FLICK_VELOCITY;
}
