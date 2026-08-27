'use client';

import { Calendar, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

export interface DateRangeValue {
  /** yyyy-mm-dd, or '' for unbounded. */
  from: string;
  to: string;
}

interface DateRangePickerProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseDateStr(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatLabel(dateStr: string): string {
  const d = parseDateStr(dateStr);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }).format(d);
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, month, day));
  return cells;
}

/**
 * A "Date range" trigger button that opens a calendar popover. Picking days
 * only updates a local draft — nothing is applied to the real filter until
 * "Save" is clicked (so browsing the calendar doesn't fire a query per
 * click), and "Reset" clears the range immediately and applies that too.
 * Clicking outside or pressing Escape discards the draft.
 */
export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRangeValue>(value);
  const [viewDate, setViewDate] = useState(() => parseDateStr(value.from) ?? new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Re-seed the draft/visible month from the committed value each time the
  // popover opens, so a previously discarded draft doesn't linger.
  function openPicker() {
    setDraft(value);
    setViewDate(parseDateStr(value.from) ?? new Date());
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function handleDayClick(day: Date) {
    const dateStr = toDateStr(day);
    if (!draft.from || (draft.from && draft.to)) {
      setDraft({ from: dateStr, to: '' });
    } else if (dateStr < draft.from) {
      setDraft({ from: dateStr, to: draft.from });
    } else {
      setDraft({ from: draft.from, to: dateStr });
    }
  }

  function handleReset() {
    const cleared = { from: '', to: '' };
    setDraft(cleared);
    onChange(cleared);
    setOpen(false);
  }

  function handleSave() {
    // A dangling single-day selection (from set, to not) is treated as a
    // one-day range rather than discarded.
    const next = draft.from && !draft.to ? { from: draft.from, to: draft.from } : draft;
    onChange(next);
    setOpen(false);
  }

  const label =
    value.from && value.to
      ? value.from === value.to
        ? formatLabel(value.from)
        : `${formatLabel(value.from)} – ${formatLabel(value.to)}`
      : value.from
        ? `${formatLabel(value.from)} – …`
        : 'Date range';

  const cells = monthGrid(viewDate.getFullYear(), viewDate.getMonth());
  const monthLabel = new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(viewDate);
  const todayStr = toDateStr(new Date());

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
          value.from || value.to
            ? 'border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]'
            : 'border-zinc-300 bg-white text-zinc-500 hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400'
        }`}
      >
        <Calendar className="size-3.5" />
        {label}
      </button>

      {open ? (
        <div className="absolute right-0 z-30 mt-2 w-72 rounded-xl border border-black/10 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-zinc-900">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Previous month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <span className="text-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              aria-label="Next month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAY_LABELS.map((w) => (
              <span key={w} className="text-[10px] font-semibold uppercase text-zinc-400">
                {w}
              </span>
            ))}
            {cells.map((day, i) => {
              if (!day) return <span key={`empty-${i}`} />;
              const dateStr = toDateStr(day);
              const isFrom = dateStr === draft.from;
              const isTo = dateStr === draft.to;
              const inRange = draft.from && draft.to && dateStr > draft.from && dateStr < draft.to;
              const isToday = dateStr === todayStr;
              return (
                <button
                  key={dateStr}
                  type="button"
                  onClick={() => handleDayClick(day)}
                  className={`relative mx-auto flex size-7 items-center justify-center rounded-full text-xs transition-colors ${
                    isFrom || isTo
                      ? 'bg-[var(--accent)] font-semibold text-white'
                      : inRange
                        ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                        : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
                  } ${isToday && !isFrom && !isTo ? 'ring-1 ring-inset ring-[var(--accent)]/50' : ''}`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-black/10 pt-3 dark:border-white/10">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <RotateCcw className="size-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-white"
            >
              Save
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
