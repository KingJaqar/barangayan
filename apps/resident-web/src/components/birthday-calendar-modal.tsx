'use client';

/**
 * Date of Birth calendar picker for the resident Profile screen — web port of
 * apps/resident-android-mobile/src/components/birthday-calendar-modal.tsx. Same day-grid
 * + year/month jump-list shape as that component and as
 * apps/resident-web/src/components/health/drive-calendar.tsx, but constrained to
 * dates of birth (no future dates, minimum year 1900) and rendered inside the
 * shared Dialog primitive instead of a bespoke overlay.
 */
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const MIN_BIRTH_YEAR = 1900;
const YEAR_CHIP_WIDTH = 68; // width + gap, kept in sync with the year chip className below

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Date → YYYY-MM-DD, using local calendar fields (not toISOString, which is UTC). */
export function dateToIso(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** YYYY-MM-DD → local Date at noon (avoids UTC-midnight rollover across timezones). */
export function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

interface Cell {
  iso: string;
  day: number;
  inMonth: boolean;
}

function buildCells(year: number, month: number): Cell[] {
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrev = new Date(year, month - 1, 0).getDate();
  const cells: Cell[] = [];

  for (let i = firstWeekday - 1; i >= 0; i--) {
    const d = daysInPrev - i;
    const pm = month === 1 ? 12 : month - 1;
    const py = month === 1 ? year - 1 : year;
    cells.push({ iso: `${py}-${pad2(pm)}-${pad2(d)}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ iso: `${year}-${pad2(month)}-${pad2(d)}`, day: d, inMonth: true });
  }
  const remainder = 42 - cells.length;
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  for (let d = 1; d <= remainder; d++) {
    cells.push({ iso: `${ny}-${pad2(nm)}-${pad2(d)}`, day: d, inMonth: false });
  }
  return cells;
}

export function BirthdayCalendarModal({
  open,
  value,
  onClose,
  onSave,
}: {
  open: boolean;
  value: Date | null;
  onClose: () => void;
  onSave: (date: Date) => void;
}) {
  const today = new Date();
  const todayIso = dateToIso(today);
  const maxYear = today.getFullYear();
  const maxMonthInMaxYear = today.getMonth() + 1; // 1-indexed

  // Default the picker to 25 years ago (a reasonable adult birth year) when no date of
  // birth is set yet, rather than opening on the current month.
  const fallback = new Date(maxYear - 25, 0, 1);

  const [viewYear, setViewYear] = useState((value ?? fallback).getFullYear());
  const [viewMonth, setViewMonth] = useState((value ?? fallback).getMonth() + 1);
  const [jumpMode, setJumpMode] = useState(false);

  useEffect(() => {
    if (open) {
      // Microtask-wrapped — see use-unread-counts.tsx's doc comment on
      // react-hooks/set-state-in-effect.
      Promise.resolve().then(() => {
        const d = value ?? fallback;
        setViewYear(d.getFullYear());
        setViewMonth(d.getMonth() + 1);
        setJumpMode(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const selectedIso = value ? dateToIso(value) : null;
  const canGoNext = !(viewYear === maxYear && viewMonth === maxMonthInMaxYear);
  const canGoPrev = !(viewYear === MIN_BIRTH_YEAR && viewMonth === 1);

  function changeMonth(delta: 1 | -1) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 1) { m = 12; y -= 1; }
    if (m > 12) { m = 1; y += 1; }
    if (y < MIN_BIRTH_YEAR) return;
    if (y > maxYear || (y === maxYear && m > maxMonthInMaxYear)) return;
    setViewYear(y);
    setViewMonth(m);
  }

  const cells = buildCells(viewYear, viewMonth);
  const rows = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="max-w-[360px] gap-3">
        <DialogTitle className="text-base">Select Date of Birth</DialogTitle>

        {jumpMode ? (
          <YearMonthGrid
            viewYear={viewYear}
            viewMonth={viewMonth}
            minYear={MIN_BIRTH_YEAR}
            maxYear={maxYear}
            maxMonthInMaxYear={maxMonthInMaxYear}
            onSelect={(y, m) => { setViewYear(y); setViewMonth(m); setJumpMode(false); }}
          />
        ) : (
          <>
            {/* Month header — tap to jump to any year/month */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setJumpMode(true)}
                className="flex items-center gap-1 text-[15px] font-bold text-primary"
                aria-label={`Open year and month picker, currently ${MONTH_NAMES[viewMonth - 1]} ${viewYear}`}>
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
                <ChevronDown size={13} />
              </button>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => changeMonth(-1)}
                  disabled={!canGoPrev}
                  className="rounded-full p-1.5 text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  aria-label="Previous month">
                  <ChevronLeft size={17} />
                </button>
                <button
                  type="button"
                  onClick={() => changeMonth(1)}
                  disabled={!canGoNext}
                  className="rounded-full p-1.5 text-foreground transition-colors hover:bg-muted disabled:opacity-30"
                  aria-label="Next month">
                  <ChevronRight size={17} />
                </button>
              </div>
            </div>

            {/* Day-of-week headers */}
            <div className="grid grid-cols-7">
              {DAY_LABELS.map((l, i) => (
                <div key={i} className="py-0.5 text-center text-[13px] font-bold text-primary">
                  {l}
                </div>
              ))}
            </div>

            {/* Day grid */}
            {rows.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7">
                {row.map((cell, ci) => {
                  const isSelected = cell.iso === selectedIso;
                  const isToday = cell.iso === todayIso;
                  const isFuture = cell.iso > todayIso;

                  return (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => onSave(isoToLocalDate(cell.iso))}
                      disabled={isFuture}
                      className="flex items-center justify-center py-0.5"
                      aria-label={cell.iso}>
                      <span
                        className={`flex h-[34px] w-[34px] items-center justify-center rounded-full text-[15px] font-bold ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : isToday
                              ? 'border-2 border-primary text-primary'
                              : ''
                        }`}>
                        <span
                          className={
                            !cell.inMonth
                              ? 'text-muted-foreground opacity-40'
                              : isFuture
                                ? 'text-muted-foreground opacity-30'
                                : undefined
                          }>
                          {cell.day}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Year (scrollable strip, 1900…current) + 4×3 month grid — jumps viewYear/viewMonth
 * far in one tap, same shape as the mobile picker's jump mode. */
function YearMonthGrid({
  viewYear,
  viewMonth,
  minYear,
  maxYear,
  maxMonthInMaxYear,
  onSelect,
}: {
  viewYear: number;
  viewMonth: number;
  minYear: number;
  maxYear: number;
  maxMonthInMaxYear: number;
  onSelect: (year: number, month: number) => void;
}) {
  const [pickerYear, setPickerYear] = useState(viewYear);
  const listRef = useRef<HTMLDivElement>(null);

  const years = useMemo(() => {
    const arr: number[] = [];
    for (let y = maxYear; y >= minYear; y--) arr.push(y);
    return arr;
  }, [minYear, maxYear]);

  useEffect(() => {
    const idx = years.indexOf(viewYear);
    if (idx >= 0) {
      const x = Math.max(0, idx * YEAR_CHIP_WIDTH - YEAR_CHIP_WIDTH * 2);
      requestAnimationFrame(() => listRef.current?.scrollTo({ left: x, behavior: 'instant' as ScrollBehavior }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={listRef} className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'thin' }}>
        {years.map((y) => {
          const isSelected = y === pickerYear;
          return (
            <button
              key={y}
              type="button"
              onClick={() => setPickerYear(y)}
              className={`min-w-[56px] shrink-0 rounded-lg px-2 py-2 text-sm font-semibold ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              }`}>
              {y}
            </button>
          );
        })}
      </div>

      <div className="my-3 h-px bg-border" />

      <div className="flex flex-wrap gap-2">
        {MONTH_ABBR.map((abbr, idx) => {
          const m = idx + 1;
          const disabled = pickerYear === maxYear && m > maxMonthInMaxYear;
          const isSelected = pickerYear === viewYear && m === viewMonth;

          return (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(pickerYear, m)}
              className={`grow basis-[22%] rounded-lg py-2.5 text-sm font-medium ${
                isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
              } ${disabled ? 'opacity-30' : ''}`}>
              {abbr}
            </button>
          );
        })}
      </div>
    </div>
  );
}
