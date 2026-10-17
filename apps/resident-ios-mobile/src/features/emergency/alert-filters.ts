import type { DateWindow } from '../../data/resident-api';

/**
 * Emergency-alert filters (A28). Every boundary is the resident's local calendar, as Android
 * computes it: "Today" is the local day, and the other periods count back from now. A custom
 * month/day/year that names one contiguous span (a year, a month of a year, a day) becomes a
 * server-side publication window so pages and counts stay exact; a month or day without a year
 * recurs across years, which no single range can express, so those are matched on the device.
 */
export type AlertPeriod = 'all' | 'today' | 'week' | 'month' | 'year';
export const ALERT_PERIOD_OPTIONS: readonly { value: AlertPeriod; label: string }[] = [
  { value: 'all', label: 'All' }, { value: 'today', label: 'Today' }, { value: 'week', label: 'Last Week' }, { value: 'month', label: 'Last Month' }, { value: 'year', label: 'Last Year' },
];

export type CustomInput = { month: string; day: string; year: string };
export type CustomFilter = { month: number | null; day: number | null; year: number | null };
export type CustomErrors = Partial<Record<keyof CustomInput, string>>;

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'] as const;

/** Month text keeps letters only; `rejected` says something else was typed so the field can explain it. */
export function sanitizeLetters(text: string): { value: string; rejected: boolean } {
  const value = text.replace(/[^A-Za-z]/g, '');
  return { value, rejected: value.length !== text.length };
}
export function sanitizeDigits(text: string, maxLength: number): { value: string; rejected: boolean } {
  const digits = text.replace(/[^0-9]/g, '');
  return { value: digits.slice(0, maxLength), rejected: digits.length !== text.length };
}

/** A month named in full or by at least its first three letters ("Jan", "sept"); null when it is not one. */
function monthNumber(text: string): number | null {
  const name = text.trim().toLowerCase();
  if (name.length < 3) return null;
  const index = MONTHS.findIndex((month) => month.startsWith(name));
  return index === -1 ? null : index + 1;
}

/** Turns the three inputs into a filter, or the message of every field that is not a valid value. */
export function parseCustom(input: CustomInput): { filter: CustomFilter; errors: CustomErrors } {
  const errors: CustomErrors = {};
  const filter: CustomFilter = { month: null, day: null, year: null };
  if (input.month.trim()) {
    filter.month = monthNumber(input.month);
    if (filter.month === null) errors.month = 'Enter a month name such as January.';
  }
  if (input.day.trim()) {
    const day = Number(input.day);
    if (Number.isInteger(day) && day >= 1 && day <= 31) filter.day = day;
    else errors.day = 'Enter a day from 1 to 31.';
  }
  if (input.year.trim()) {
    const year = Number(input.year);
    if (/^\d{4}$/.test(input.year.trim()) && year >= 1000) filter.year = year;
    else errors.year = 'Enter a four-digit year such as 2026.';
  }
  return { filter, errors };
}

/** How many custom fields hold text, for the "active filters" count. */
export function activeCustomCount(input: CustomInput): number {
  return [input.month, input.day, input.year].filter((value) => value.trim().length > 0).length;
}

type Span = { from: Date | null; to: Date | null };
export type AlertQuery = {
  /** The filters can match nothing (for example 31 April), so no read is needed. */
  empty: boolean;
  window: Span;
  /** Set when the custom fields recur across years and must be matched on the device. */
  match: CustomFilter | null;
};

function daysBack(now: Date, days: number): Date {
  const date = new Date(now.getTime());
  date.setDate(date.getDate() - days);
  return date;
}
function periodSpan(period: AlertPeriod, now: Date): Span {
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return { from: start, to: new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1) };
  }
  if (period === 'week') return { from: daysBack(now, 7), to: null };
  if (period === 'month') return { from: daysBack(now, 30), to: null };
  if (period === 'year') return { from: daysBack(now, 365), to: null };
  return { from: null, to: null };
}
/** The contiguous span a custom filter names, `'recurring'` when it has no single range, or null for no filter. */
function customSpan(filter: CustomFilter): Span | 'recurring' | 'impossible' | null {
  const { month, day, year } = filter;
  if (month === null && day === null && year === null) return null;
  if (year === null) return 'recurring';
  if (day !== null && month === null) return 'recurring';
  if (month === null) return { from: new Date(year, 0, 1), to: new Date(year + 1, 0, 1) };
  if (day === null) return { from: new Date(year, month - 1, 1), to: new Date(year, month, 1) };
  const start = new Date(year, month - 1, day);
  // A day that does not exist in that month rolls into the next one; such a date matches nothing.
  if (start.getMonth() !== month - 1) return 'impossible';
  return { from: start, to: new Date(year, month - 1, day + 1) };
}

function intersect(a: Span, b: Span): Span {
  const from = a.from && b.from ? (a.from > b.from ? a.from : b.from) : a.from ?? b.from;
  const to = a.to && b.to ? (a.to < b.to ? a.to : b.to) : a.to ?? b.to;
  return { from, to };
}

export function buildAlertQuery(period: AlertPeriod, custom: CustomFilter, now: Date = new Date()): AlertQuery {
  const preset = periodSpan(period, now);
  const named = customSpan(custom);
  if (named === 'impossible') return { empty: true, window: preset, match: null };
  if (named === 'recurring') return { empty: false, window: preset, match: custom };
  const window = named ? intersect(preset, named) : preset;
  const empty = window.from !== null && window.to !== null && window.from >= window.to;
  return { empty, window, match: null };
}

export function toDateWindow(query: AlertQuery): DateWindow {
  return { from: query.window.from?.toISOString() ?? null, to: query.window.to?.toISOString() ?? null };
}

/** True when an instant's local month/day/year agree with every field that is set. */
export function matchesCustom(iso: string, filter: CustomFilter): boolean {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return false;
  if (filter.month !== null && date.getMonth() + 1 !== filter.month) return false;
  if (filter.day !== null && date.getDate() !== filter.day) return false;
  if (filter.year !== null && date.getFullYear() !== filter.year) return false;
  return true;
}
