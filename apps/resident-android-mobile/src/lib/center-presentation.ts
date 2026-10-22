/** Unknown capacity must never be presented as an empty, available center. */
export function centerOccupancy(occupants: number, capacity: number | null) {
  const known = capacity !== null && Number.isFinite(capacity) && capacity > 0 && Number.isFinite(occupants) && occupants >= 0;
  const percent = known ? occupants >= capacity ? Math.round(occupants / capacity * 100) : Math.min(99, Math.round(occupants / capacity * 100)) : null;
  return {
    percent,
    fill: percent === null ? 0 : Math.min(100, percent),
    tone: percent === null ? 'muted' : percent >= 100 ? 'danger' : percent >= 80 ? 'warning' : 'success',
    label: percent === null ? 'Capacity unknown' : `${percent >= 100 ? 'FULL' : `${percent}%`} (${occupants.toLocaleString()}/${capacity?.toLocaleString()})`,
  } as const;
}
