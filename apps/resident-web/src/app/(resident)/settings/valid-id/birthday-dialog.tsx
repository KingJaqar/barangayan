'use client';

import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { birthdayIso, birthdayMaximum, birthdayParts, daysInMonth, limitBirthday, MONTHS } from './draft';

function Wheel({ label, values, value, onChange, wheelRef, labels }: {
  label: string; values: number[]; value: number; onChange: (value: number) => void;
  wheelRef: RefObject<HTMLDivElement | null>; labels?: string[];
}) {
  const index = Math.max(0, values.indexOf(value));
  useLayoutEffect(() => {
    const node = wheelRef.current;
    if (node && Math.round(node.scrollTop / 40) !== index) node.scrollTop = index * 40;
  }, [index, wheelRef]);
  function choose(next: number) {
    const bounded = Math.max(0, Math.min(next, values.length - 1));
    onChange(values[bounded]);
    if (wheelRef.current) wheelRef.current.scrollTop = bounded * 40;
  }
  return <div className="min-w-0 flex-1">
    <p className="mb-2 text-center text-xs font-semibold">{label}</p>
    <div className="relative">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-20 h-10 rounded-lg bg-[var(--accent-tint)] ring-1 ring-[var(--accent)]/20" />
      <div ref={wheelRef} role="spinbutton" tabIndex={0} aria-label={label} aria-valuemin={values[0]} aria-valuemax={values[values.length - 1]} aria-valuenow={value} aria-valuetext={labels?.[index] ?? String(value)}
        className="relative h-[200px] snap-y snap-mandatory overflow-y-auto overscroll-contain py-20 text-center outline-none focus-visible:ring-2 focus-visible:ring-ring [scrollbar-width:none] [mask-image:linear-gradient(transparent,black_35%,black_65%,transparent)]"
        onScroll={event => { const selected = values[Math.max(0, Math.min(values.length - 1, Math.round(event.currentTarget.scrollTop / 40)))]; if (selected !== value) onChange(selected); }}
        onKeyDown={event => {
          const offset = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : event.key === 'PageDown' ? 10 : event.key === 'PageUp' ? -10 : 0;
          if (offset || event.key === 'Home' || event.key === 'End') { event.preventDefault(); choose(event.key === 'Home' ? 0 : event.key === 'End' ? values.length - 1 : index + offset); }
        }}>
        {values.map((item, i) => <button key={item} type="button" tabIndex={-1} className={`block h-10 w-full snap-center truncate px-1 text-sm ${item === value ? 'font-bold text-foreground' : 'text-muted-foreground'}`} onClick={() => choose(i)}>{labels?.[i] ?? item}</button>)}
      </div>
    </div>
  </div>;
}

export function BirthdayDialog({ value, onClose, onConfirm, triggerRef }: {
  value: string; onClose: () => void; onConfirm: (value: string) => void; triggerRef: RefObject<HTMLButtonElement | null>;
}) {
  const [maximum] = useState(() => birthdayMaximum());
  const [parts, setParts] = useState(() => birthdayParts(value, maximum));
  const monthRef = useRef<HTMLDivElement>(null), dayRef = useRef<HTMLDivElement>(null), yearRef = useRef<HTMLDivElement>(null);
  const maxYear = Number(maximum.slice(0, 4));
  const years = Array.from({ length: maxYear }, (_, i) => i + 1);
  const months = Array.from({ length: parts.year === maxYear ? Number(maximum.slice(5, 7)) : 12 }, (_, i) => i + 1);
  const maxDay = parts.year === maxYear && parts.month === Number(maximum.slice(5, 7)) ? Number(maximum.slice(8, 10)) : daysInMonth(parts.year, parts.month);
  const days = Array.from({ length: maxDay }, (_, i) => i + 1);
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-md" onCloseAutoFocus={event => { event.preventDefault(); triggerRef.current?.focus(); }}>
      <DialogTitle>Birthday shown on ID</DialogTitle>
      <DialogDescription>Scroll, tap, or use arrow keys to choose a date. Only Use date saves your selection.</DialogDescription>
      <div className="flex gap-2">
        <Wheel label="Month" values={months} labels={MONTHS.slice(0, months.length)} value={parts.month} wheelRef={monthRef} onChange={month => setParts(previous => limitBirthday({ ...previous, month }, maximum))} />
        <Wheel label="Day" values={days} value={parts.day} wheelRef={dayRef} onChange={day => setParts(previous => limitBirthday({ ...previous, day }, maximum))} />
        <Wheel label="Year" values={years} value={parts.year} wheelRef={yearRef} onChange={year => setParts(previous => limitBirthday({ ...previous, year }, maximum))} />
      </div>
      <Button onClick={() => {
        // Read the currently visible row, including an unsettled fast scroll.
        const selected = (node: HTMLDivElement | null, values: number[], fallback: number) => node ? values[Math.max(0, Math.min(values.length - 1, Math.round(node.scrollTop / 40)))] : fallback;
        const visible = { year: selected(yearRef.current, years, parts.year), month: selected(monthRef.current, months, parts.month), day: selected(dayRef.current, days, parts.day) };
        onConfirm(birthdayIso(limitBirthday(visible, birthdayMaximum())));
      }}>Use date</Button>
      <Button variant="outline" onClick={() => onConfirm('')}>Not shown on ID</Button>
      <Button variant="ghost" onClick={onClose}>Cancel</Button>
    </DialogContent>
  </Dialog>;
}
