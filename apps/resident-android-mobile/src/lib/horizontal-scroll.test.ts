import { describe, expect, it } from 'vitest';
import { horizontalScrollEdges, horizontalScrollTarget } from './horizontal-scroll';

describe('measured shelf overflow', () => {
  it('hides both controls for unmeasured, empty, one-card and exact-fit rows', () => {
    for (const [width, content] of [[0, 800], [360, 0], [360, 284], [360, 360], [360, 364]]) {
      expect(horizontalScrollEdges(0, width, content)).toEqual({ left: false, right: false });
    }
  });
  it('shows only reachable directions with the reference four-pixel tolerance', () => {
    expect(horizontalScrollEdges(0, 360, 796)).toEqual({ left: false, right: true });
    expect(horizontalScrollEdges(256, 360, 796)).toEqual({ left: true, right: true });
    expect(horizontalScrollEdges(436, 360, 796)).toEqual({ left: true, right: false });
    expect(horizontalScrollEdges(-20, 360, 796)).toEqual({ left: false, right: true });
    expect(horizontalScrollEdges(500, 360, 284)).toEqual({ left: false, right: false });
  });
  it('moves one measured card and gap, clamps both ends and handles content shrink', () => {
    expect(horizontalScrollTarget(0, 360, 796, 256, 1)).toBe(256);
    expect(horizontalScrollTarget(256, 360, 796, 256, 1)).toBe(436);
    expect(horizontalScrollTarget(436, 360, 796, 256, -1)).toBe(180);
    expect(horizontalScrollTarget(0, 360, 796, 256, -1)).toBe(0);
    expect(horizontalScrollTarget(436, 360, 284, 256, 1)).toBe(0);
  });
});
