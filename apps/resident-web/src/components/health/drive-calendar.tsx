'use client';

import { ChevronDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useState } from 'react';

import styles from './health.module.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad2 = (n: number) => String(n).padStart(2, '0');

export function localToday(): string {
  const t = new Date();
  return `${t.getFullYear()}-${pad2(t.getMonth() + 1)}-${pad2(t.getDate())}`;
}

interface Cell {
  date: string;
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
    cells.push({ date: `${py}-${pad2(pm)}-${pad2(d)}`, day: d, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: `${year}-${pad2(month)}-${pad2(d)}`, day: d, inMonth: true });
  }
  const remainder = 42 - cells.length;
  const nm = month === 12 ? 1 : month + 1;
  const ny = month === 12 ? year + 1 : year;
  for (let d = 1; d <= remainder; d++) {
    cells.push({ date: `${ny}-${pad2(nm)}-${pad2(d)}`, day: d, inMonth: false });
  }
  return cells;
}

/**
 * Month calendar with per-type color dots under each day, plus a month/year picker
 * dialog opened from the header — web port of mobile's DriveCalendar + MonthYearPicker
 * (health/index.tsx).
 */
export function DriveCalendar({
  selectedDate,
  onDateSelect,
  eventDateMap,
  currentMonth,
  onMonthChange,
  onJumpTo,
}: {
  selectedDate: string;
  onDateSelect: (date: string) => void;
  eventDateMap: Record<string, string[]>;
  currentMonth: { year: number; month: number };
  onMonthChange: (delta: 1 | -1) => void;
  onJumpTo: (year: number, month: number) => void;
}) {
  const { year, month } = currentMonth;
  const today = localToday();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(year);

  function openPicker() {
    setPickerYear(year);
    setPickerOpen(true);
  }

  const todayDate = new Date();
  const todayYear = todayDate.getFullYear();
  const todayMonth = todayDate.getMonth() + 1;
  const MIN_YEAR = todayYear - 1;
  const MAX_YEAR = todayYear + 5;

  const cells = buildCells(year, month);
  const rows = Array.from({ length: 6 }, (_, i) => cells.slice(i * 7, i * 7 + 7));

  return (
    <div className={styles.calendar}>
      {/* Header */}
      <div className={styles.calendarHeader}>
        <button
          type="button"
          onClick={openPicker}
          className="flex min-h-9 items-center gap-1 text-[15px] font-semibold tracking-tight"
          aria-expanded={pickerOpen}
          aria-label={`Open month and year picker, currently ${MONTH_NAMES[month - 1]} ${year}`}>
          {MONTH_NAMES[month - 1]} {year}
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${pickerOpen ? 'rotate-180' : ''}`} />
        </button>
        <div className="flex gap-0.5">
          <button type="button" onClick={() => onMonthChange(-1)} aria-label="Previous month" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronLeft size={16} />
          </button>
          <button type="button" onClick={() => onMonthChange(1)} aria-label="Next month" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Day-of-week headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="py-0.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            {l}
          </div>
        ))}
      </div>

      {/* Day grid */}
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-7">
          {row.map((cell, ci) => {
            const isSelected = cell.date === selectedDate;
            const isToday = cell.date === today;
            const eventColors = eventDateMap[cell.date] ?? [];
            const hasEvents = eventColors.length > 0;

            return (
              <button
                key={ci}
                type="button"
                onClick={() => onDateSelect(cell.date)}
                className={`${styles.calendarDay} flex min-h-10 items-center justify-center py-0.5`}
                aria-label={`${cell.date}${hasEvents ? ', drives scheduled' : ''}`}
                aria-pressed={isSelected}
                aria-current={isSelected ? 'date' : undefined}>
                <span
                  className={`relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full transition-colors ${isSelected ? 'border border-primary bg-primary/15' : isToday ? 'border border-primary' : 'hover:bg-muted'}`}>
                  <span
                    className={`text-[13px] font-semibold ${isSelected ? 'text-foreground' : !cell.inMonth ? 'text-muted-foreground opacity-60' : isToday ? 'text-primary' : 'text-foreground'}`}>
                    {cell.day}
                  </span>
                  {hasEvents ? (
                    <span className="absolute bottom-[3px] flex items-center justify-center gap-[2px]">
                      {eventColors.slice(0, 3).map((color, index) => (
                        <span key={index} className="h-1 w-1 rounded-full" style={{ backgroundColor: color }} />
                      ))}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ))}
      <p className={styles.calendarLegend}>Scheduled drives · dots match drive categories</p>

      {/* Month/year picker overlay */}
      {pickerOpen ? (
        <div className={styles.calendarPicker}>
          <div className="w-full max-w-xs">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold">Select Month &amp; Year</p>
              <button type="button" onClick={() => setPickerOpen(false)} aria-label="Close" className="rounded-full p-1 text-muted-foreground hover:bg-muted">
                <X size={16} />
              </button>
            </div>

            <div className="mb-3 flex items-center justify-between px-2">
              <button
                type="button"
                onClick={() => setPickerYear((y) => Math.max(y - 1, MIN_YEAR))}
                disabled={pickerYear <= MIN_YEAR}
                aria-label="Previous year"
                className="rounded-lg p-1.5 text-primary disabled:opacity-30">
                <ChevronLeft size={20} />
              </button>
              <span className="text-xl font-bold text-primary">{pickerYear}</span>
              <button
                type="button"
                onClick={() => setPickerYear((y) => Math.min(y + 1, MAX_YEAR))}
                disabled={pickerYear >= MAX_YEAR}
                aria-label="Next year"
                className="rounded-lg p-1.5 text-primary disabled:opacity-30">
                <ChevronRight size={20} />
              </button>
            </div>

            <div className="mb-3 h-px bg-border" />

            <div className="grid grid-cols-4 gap-2">
              {MONTH_ABBR.map((abbr, idx) => {
                const m = idx + 1;
                const isSelected = pickerYear === year && m === month;
                const isToday = pickerYear === todayYear && m === todayMonth;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      onJumpTo(pickerYear, m);
                      setPickerOpen(false);
                    }}
                    className={`rounded-lg py-2.5 text-sm font-medium ${
                      isSelected ? 'border border-primary bg-primary/15 font-bold text-foreground' : isToday ? 'border-[1.5px] border-primary font-bold text-primary' : 'text-foreground hover:bg-muted'
                    }`}>
                    {abbr}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
