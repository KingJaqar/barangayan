export const BIRTHDAY_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export type BirthdayParts = { year: number; month: number; day: number };
export function daysInBirthdayMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
export function birthdayIso({ year, month, day }: BirthdayParts): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
export function birthdayParts(value: string, today = new Date()): BirthdayParts {
  const [year, month, day] = value.split('-').map(Number);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && year >= 100 && month >= 1 && month <= 12 && day >= 1 && day <= daysInBirthdayMonth(year, month)) {
    return limitBirthday({ year, month, day }, today);
  }
  return { year: today.getFullYear() - 18, month: 1, day: 1 };
}
/** Month/year changes keep a real date, including leap days and today's limit. */
export function limitBirthday(parts: BirthdayParts, today = new Date()): BirthdayParts {
  const year = Math.min(parts.year, today.getFullYear());
  const maximumMonth = year === today.getFullYear() ? today.getMonth() + 1 : 12;
  const month = Math.max(1, Math.min(parts.month, maximumMonth));
  const maximumDay = year === today.getFullYear() && month === today.getMonth() + 1 ? today.getDate() : daysInBirthdayMonth(year, month);
  return { year, month, day: Math.max(1, Math.min(parts.day, maximumDay)) };
}
export function birthdayLabel(value: string): string {
  if (!value) return 'Select date of birth';
  const [year, month, day] = value.split('-').map(Number);
  return `${BIRTHDAY_MONTHS[month - 1]} ${day}, ${year}`;
}
