/** A center the resident can pick in "Show QR" (an active center of the barangay). */
export type SelectableCenter = { id: string; name: string };

/**
 * The center the sheet shows: the resident's choice, or the first center when there is none yet. A choice that is no longer in the
 * list (the center was removed or deactivated while the sheet was open) falls back to the first center and says so; with no centers
 * there is nothing to show.
 */
export function pickCenter<T extends SelectableCenter>(centers: readonly T[], selectedId: string | null): { center: T; replaced: boolean } | null {
  if (centers.length === 0) return null;
  const chosen = selectedId === null ? undefined : centers.find((center) => center.id === selectedId);
  if (chosen) return { center: chosen, replaced: false };
  return { center: centers[0], replaced: selectedId !== null };
}
