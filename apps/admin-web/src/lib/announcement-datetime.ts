/** Local input format; keep seconds/milliseconds when reopening an existing expiry. */
export function announcementDateTimeInput(iso: string | null | undefined): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, -1);
}

/** Reject invalid calendar dates and local clock gaps instead of silently normalizing them. */
export function announcementDateTimeIso(value: string): string | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(value);
  if (!parts || Number(parts[1]) === 0) return null;
  const date = new Date(value);
  const expected = parts.slice(1, 7).map(part => Number(part ?? 0));
  const actual = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  if (!Number.isFinite(date.getTime()) || actual.some((part, index) => part !== expected[index])) return null;
  return date.toISOString();
}
