export function horizontalScrollEdges(offset: number, width: number, content: number) {
  const max = Math.max(0, content - width);
  const x = Math.max(0, Math.min(max, offset));
  return { left: width > 0 && x > 4, right: width > 0 && x < max - 4 };
}

export function horizontalScrollTarget(offset: number, width: number, content: number, step: number, direction: number) {
  return Math.max(0, Math.min(Math.max(0, content - width), offset + direction * step));
}
