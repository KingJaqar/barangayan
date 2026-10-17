import { DRIVE_TYPE_CONFIG, DRIVE_TYPES, type DriveType } from '@barangayan/shared';
import type { DriveItem } from '../../data/resident-api';
import { daysInMonth } from '../profile/birthday';

/** Calendar months are plain year/month pairs (1–12); no value here is a time-zone instant, so no day can shift. */
export type MonthRef = { year: number; month: number };

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
/** The years the month chooser offers: drives are scheduled by the barangay, never decades away. */
export const FIRST_CALENDAR_YEAR = 2020;
export const LAST_CALENDAR_YEAR = 2100;

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;
const pad2 = (value: number) => String(value).padStart(2, '0');

/** Today's calendar date in the barangay's time zone (Asia/Manila, UTC+8 all year), the same day the registration RPC compares against. */
export function manilaToday(now: Date = new Date()): string {
  return new Date(now.getTime() + MANILA_OFFSET_MS).toISOString().slice(0, 10);
}

export function monthOf(iso: string): MonthRef {
  return { year: Number(iso.slice(0, 4)), month: Number(iso.slice(5, 7)) };
}

export const dateIso = (ref: MonthRef, day: number) => `${String(ref.year).padStart(4, '0')}-${pad2(ref.month)}-${pad2(day)}`;

/** The month before or after `ref`, clamped to the supported years. */
export function shiftMonth(ref: MonthRef, delta: 1 | -1): MonthRef {
  const index = ref.year * 12 + (ref.month - 1) + delta;
  const next = { year: Math.floor(index / 12), month: (index % 12) + 1 };
  return next.year < FIRST_CALENDAR_YEAR || next.year > LAST_CALENDAR_YEAR ? ref : next;
}

export function monthBounds(ref: MonthRef): { from: string; to: string } {
  return { from: dateIso(ref, 1), to: dateIso(ref, daysInMonth(ref.year, ref.month)) };
}

/** Weeks (Sunday first) of day numbers; `null` pads the first and last week. */
export function monthGrid(ref: MonthRef): (number | null)[][] {
  const lead = new Date(Date.UTC(ref.year, ref.month - 1, 1)).getUTCDay();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: daysInMonth(ref.year, ref.month) }, (_, index) => index + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, week) => cells.slice(week * 7, week * 7 + 7));
}

export type DriveCategory = { type: DriveType; label: string; color: string };
/** The configured category of a drive; a type this app does not know is shown as Others rather than dropping the drive. */
export function categoryOf(type: string): DriveCategory {
  const known = DRIVE_TYPES.find((candidate) => candidate === type) ?? 'others';
  return { type: known, label: DRIVE_TYPE_CONFIG[known].label, color: DRIVE_TYPE_CONFIG[known].color };
}

export type CategoryFilter = DriveType | 'all';
/** Every configured category, so no source category is dropped to fit a layout. */
export const CATEGORY_OPTIONS: readonly { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All categories' },
  ...DRIVE_TYPES.map((type) => ({ value: type, label: DRIVE_TYPE_CONFIG[type].label })),
];

export const filterByCategory = (drives: readonly DriveItem[], category: CategoryFilter) =>
  category === 'all' ? [...drives] : drives.filter((drive) => categoryOf(drive.type).type === category);

export const drivesOnDate = (drives: readonly DriveItem[], date: string) => drives.filter((drive) => drive.drive_date === date);

/** Up to three distinct category colors per day for the calendar dots; the day's label states the full count. */
export function dotsByDate(drives: readonly DriveItem[]): Record<string, DriveCategory[]> {
  const map: Record<string, DriveCategory[]> = {};
  for (const drive of drives) {
    const category = categoryOf(drive.type);
    const dots = map[drive.drive_date] ?? (map[drive.drive_date] = []);
    if (dots.length < 3 && !dots.some((dot) => dot.type === category.type)) dots.push(category);
  }
  return map;
}

/** `08:00:00` → `8:00 AM`. */
export function formatClock(value: string): string {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return value;
  return `${hours % 12 || 12}:${pad2(minutes)} ${hours >= 12 ? 'PM' : 'AM'}`;
}

export const formatTimeRange = (drive: Pick<DriveItem, 'time_start' | 'time_end'>) => `${formatClock(drive.time_start)} – ${formatClock(drive.time_end)}`;

/** `2026-09-26` → `Saturday, September 26, 2026`, computed from the date parts so no time zone can move the day. */
export function formatDriveDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) return iso;
  return `${WEEKDAY_NAMES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]}, ${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

export const formatMonth = (ref: MonthRef) => `${MONTH_NAMES[ref.month - 1]} ${ref.year}`;

/** open: can be registered for; full: no slots left; closed: the drive date has passed. A passed date wins over an empty stock. */
export type Availability = 'open' | 'full' | 'closed';
export function driveAvailability(drive: Pick<DriveItem, 'drive_date' | 'stock_remaining'>, today: string): Availability {
  if (drive.drive_date < today) return 'closed';
  return drive.stock_remaining <= 0 ? 'full' : 'open';
}

export const AVAILABILITY_LABEL: Record<Availability, string> = { open: 'Registration open', full: 'No slots left', closed: 'Registration closed' };

/** Remaining stock as a 0–1 fraction of the total; a missing or invalid total reads as empty, never as full. */
export function stockFraction(drive: Pick<DriveItem, 'stock_total' | 'stock_remaining'>): number {
  if (drive.stock_total <= 0) return 0;
  return Math.max(0, Math.min(1, drive.stock_remaining / drive.stock_total));
}

export const stockSummary = (drive: Pick<DriveItem, 'stock_label' | 'stock_total' | 'stock_remaining' | 'stock_unit'>) =>
  `${drive.stock_label}: ${Math.max(0, drive.stock_remaining)} of ${drive.stock_total} ${drive.stock_unit}`;
