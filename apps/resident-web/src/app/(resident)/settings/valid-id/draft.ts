import { ID_TYPES, OTHER_ID_TYPE_PREFIX, idConfirmedDetailsSchema, type IdConfirmedDetails } from '@barangayan/shared';

export const emptyDetails = (): IdConfirmedDetails => ({ fullName: '', idNumber: '', birthDate: '', address: '' });
export type DetailField = keyof IdConfirmedDetails;
export const detailFields: DetailField[] = ['fullName', 'idNumber', 'birthDate', 'address'];
export const detailLabels: Record<DetailField, string> = { fullName: 'Full name', idNumber: 'ID number', birthDate: 'Birthday', address: 'Address' };
export const detailLimits = { fullName: 200, idNumber: 200, address: 1000 };
export function composedIdType(type: string, other: string): string {
  if (!(ID_TYPES as readonly string[]).includes(type)) return '';
  const value = type === 'Other' ? (other.trim() ? `${OTHER_ID_TYPE_PREFIX}${other.trim()}` : '') : type;
  return value.length <= 200 ? value : '';
}
export function detailErrors(details: IdConfirmedDetails): Partial<Record<DetailField, string>> {
  const result = idConfirmedDetailsSchema.safeParse(details);
  if (result.success) return {};
  const errors: Partial<Record<DetailField, string>> = {};
  for (const issue of result.error.issues) {
    const field = detailFields.find(key => key === issue.path[0]);
    if (field) errors[field] = field === 'fullName' && !details.fullName.trim()
      ? 'Enter the full name shown on your ID.'
      : field === 'birthDate' ? 'Choose a valid date of birth.' : `${detailLabels[field]} must be at most ${detailLimits[field]} characters.`;
  }
  return errors;
}
/** A clear is an edit too. Never let an in-flight read restore a cleared value. */
export function mergeSuggestions(details: IdConfirmedDetails, edited: ReadonlySet<DetailField>, suggestions: IdConfirmedDetails): IdConfirmedDetails {
  const merged = { ...details };
  for (const key of detailFields) if (!edited.has(key) && !details[key].trim()) merged[key] = suggestions[key];
  return merged;
}
export function readSuggestions(value: unknown): IdConfirmedDetails | null {
  if (!value || typeof value !== 'object' || !('details' in value)) return null;
  const details = value.details;
  if (!details || typeof details !== 'object' || Array.isArray(details) || Object.keys(details).some(key => !detailFields.some(field => field === key))) return null;
  const result = emptyDetails();
  for (const key of detailFields) {
    if (!(key in details)) return null;
    // Validate each optional suggestion independently; a missing name is valid OCR output.
    const fieldValue: unknown = Reflect.get(details, key);
    if (typeof fieldValue !== 'string') return null;
    const check = idConfirmedDetailsSchema.shape[key].safeParse(fieldValue);
    if (check.success) result[key] = check.data;
  }
  return result;
}

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export type BirthdayParts = { year: number; month: number; day: number };
export const birthdayIso = ({ year, month, day }: BirthdayParts) => `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
// Pure Android calendar rules, adapted for years 0001–0099 and the shared UTC cap.
export function daysInMonth(year: number, month: number): number {
  return month === 2 ? (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28) : [4, 6, 9, 11].includes(month) ? 30 : 31;
}
export function birthdayMaximum(now = new Date()): string {
  const local = birthdayIso({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() });
  const utc = now.toISOString().slice(0, 10);
  return local < utc ? local : utc;
}
export function limitBirthday(parts: BirthdayParts, maximum: string): BirthdayParts {
  const [maxYear, maxMonth, maxDay] = maximum.split('-').map(Number);
  const year = Math.max(1, Math.min(parts.year, maxYear));
  const month = Math.max(1, Math.min(parts.month, year === maxYear ? maxMonth : 12));
  const day = Math.max(1, Math.min(parts.day, daysInMonth(year, month), year === maxYear && month === maxMonth ? maxDay : 31));
  return { year, month, day };
}
export function birthdayParts(value: string, maximum: string): BirthdayParts {
  const [year, month, day] = value.split('-').map(Number);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month)) return limitBirthday({ year, month, day }, maximum);
  return { year: Math.max(1, Number(maximum.slice(0, 4)) - 18), month: 1, day: 1 };
}
