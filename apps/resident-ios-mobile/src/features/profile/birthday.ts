export const BIRTHDAY_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const EARLIEST_BIRTH_YEAR = 1900;
/** Date-only calendar values; never a Date/time zone instant, so no day can shift. */
export type BirthdayParts = { year: number; month: number; day: number };

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function birthdayIso({ year, month, day }: BirthdayParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** A real calendar date at or after the earliest supported year, or null. */
export function parseCalendarDate(value: string | null | undefined): BirthdayParts | null {
  const matched = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!matched) return null;
  const parts = { year: Number(matched[1]), month: Number(matched[2]), day: Number(matched[3]) };
  if (parts.year < EARLIEST_BIRTH_YEAR || parts.month < 1 || parts.month > 12 || parts.day < 1 || parts.day > daysInMonth(parts.year, parts.month)) return null;
  return parts;
}

/** A real, non-future calendar date inside the supported range, or null. */
export function parseBirthday(value: string | null | undefined, today = new Date()): BirthdayParts | null {
  const parts = parseCalendarDate(value);
  return parts && birthdayIso(parts) <= todayIso(today) ? parts : null;
}

function todayIso(today = new Date()): string {
  return birthdayIso({ year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() });
}

/** The newest selectable month and day in a year/month, so a future date can never be chosen. */
export function limitBirthday(parts: BirthdayParts, today = new Date()): BirthdayParts {
  const year = Math.max(EARLIEST_BIRTH_YEAR, Math.min(parts.year, today.getFullYear()));
  const newestMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
  const month = Math.max(1, Math.min(parts.month, newestMonth));
  const newestDay = year === today.getFullYear() && month === today.getMonth() + 1 ? today.getDate() : daysInMonth(year, month);
  return { year, month, day: Math.max(1, Math.min(parts.day, newestDay)) };
}

/** Starting point of the picker: the saved birthday, otherwise an adult-age fallback (A38-009). */
export function pickerStart(value: string | null | undefined, today = new Date()): BirthdayParts {
  return parseBirthday(value, today) ?? limitBirthday({ year: today.getFullYear() - 25, month: 1, day: 1 }, today);
}

/** Months offered for a year; the current year stops at the current month. */
export function selectableMonths(year: number, today = new Date()): number[] {
  const newest = year >= today.getFullYear() ? today.getMonth() + 1 : 12;
  return Array.from({ length: newest }, (_, index) => index + 1);
}

export function selectableDays(year: number, month: number, today = new Date()): number[] {
  const length = year === today.getFullYear() && month === today.getMonth() + 1 ? today.getDate() : daysInMonth(year, month);
  return Array.from({ length }, (_, index) => index + 1);
}

export function birthdayLabel(value: string | null | undefined): string {
  const parts = parseCalendarDate(value);
  return parts ? `${BIRTHDAY_MONTHS[parts.month - 1]} ${parts.day}, ${parts.year}` : '';
}
