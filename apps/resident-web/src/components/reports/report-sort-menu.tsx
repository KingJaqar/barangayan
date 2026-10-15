'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Check, ChevronDown, ListFilter, ALargeSmall, Users } from 'lucide-react';
import styles from './reports.module.css';

export type ReportSort = 'newest' | 'oldest' | 'confirmations' | 'title';
const OPTIONS = [
  { value: 'newest', label: 'Latest first', icon: ArrowDownWideNarrow },
  { value: 'oldest', label: 'Oldest first', icon: ArrowUpWideNarrow },
  { value: 'confirmations', label: 'Most confirmed', icon: Users },
  { value: 'title', label: 'Title A–Z', icon: ALargeSmall },
] as const;

export function ReportSortMenu({ value, onChange }: { value: ReportSort; onChange: (value: ReportSort) => void }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const search = useRef({ text: '', time: 0 });
  const id = useId();
  const reducedMotion = useReducedMotion();
  const selected = OPTIONS.findIndex(option => option.value === value);

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [open]);

  function choose(index: number) {
    onChange(OPTIONS[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div ref={root} className={styles.sortControl} onBlur={event => {
      if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
    }}>
      <button ref={trigger} type="button" className={styles.sortTrigger} role="combobox"
        aria-label={`Sort reports: ${OPTIONS[selected].label}`} aria-haspopup="listbox" aria-expanded={open}
        aria-controls={open ? id : undefined} aria-activedescendant={open ? `${id}-${active}` : undefined}
        onClick={() => { setActive(selected); setOpen(!open); }}
        onKeyDown={event => {
          if (event.key === 'Escape' || event.key === 'Tab') {
            if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); }
            setOpen(false);
            return;
          }
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
            setActive(event.key === 'Home' ? 0 : event.key === 'End' ? OPTIONS.length - 1
              : !open ? selected : (active + (event.key === 'ArrowDown' ? 1 : -1) + OPTIONS.length) % OPTIONS.length);
          } else if (open && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            choose(active);
          } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey && event.key !== ' ') {
            event.preventDefault();
            const text = (Date.now() - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase();
            search.current = { text, time: Date.now() };
            const match = OPTIONS.findIndex(option => option.label.toLowerCase().startsWith(text));
            if (match >= 0) { setActive(match); setOpen(true); }
          }
        }}>
        <ListFilter size={17} aria-hidden="true" />
        <span>{OPTIONS[selected].label}</span>
        <ChevronDown size={15} aria-hidden="true" className={styles.sortChevron} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.ul id={id} role="listbox" aria-label="Sort reports" className={styles.sortMenu}
            initial={{ opacity: 0, y: reducedMotion ? 0 : -4 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: reducedMotion ? 0 : -3 }} transition={{ duration: reducedMotion ? 0 : .15, ease: 'easeOut' }}>
            {OPTIONS.map((option, index) => (
              <li key={option.value} id={`${id}-${index}`} role="option" aria-selected={value === option.value}
                data-active={active === index || undefined} className={styles.sortOption}
                onPointerMove={() => setActive(index)} onPointerDown={event => event.preventDefault()} onClick={() => choose(index)}>
                <option.icon size={17} aria-hidden="true" />
                <span>{option.label}</span>
                {value === option.value && <Check size={16} aria-hidden="true" className={styles.sortCheck} />}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
