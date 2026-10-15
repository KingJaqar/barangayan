'use client';

import { useCallback, useEffect, useId, useRef, useState, type InputHTMLAttributes } from 'react';
import { FileText } from 'lucide-react';
import { DropdownSurface } from './dropdown-surface';
import styles from './dropdown.module.css';

/** Editable text with optional suggestions; every change uses the existing text callback. */
export function AdminSuggestions({ value, onValueChange, options, onKeyDown, onBlur, onFocus, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'list'> & {
  value: string; onValueChange: (value: string) => void; options: readonly string[];
}) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const dismiss = useCallback(() => setOpen(false), []);
  const matches = options.filter(option => option.toLowerCase().includes(value.toLowerCase()));
  useEffect(() => {
    if (open && active >= 0) document.getElementById(`${id}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, id]);
  function choose(index: number) {
    const next = matches[index];
    if (next === undefined || input.current?.matches(':disabled')) return;
    dismiss(); setActive(-1);
    if (next !== value) onValueChange(next);
    input.current?.focus({ preventScroll: true });
  }
  return <span className={styles.root}>
    <input {...props} ref={input} value={value} role="combobox" aria-autocomplete="list" aria-expanded={open && matches.length > 0}
      aria-controls={open && matches.length ? id : undefined} aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
      autoComplete="off" onChange={event => { onValueChange(event.target.value); setActive(-1); setOpen(true); }}
      onFocus={event => { setOpen(true); onFocus?.(event); }} onBlur={event => { dismiss(); onBlur?.(event); }}
      onKeyDown={event => {
        if (event.nativeEvent.isComposing) return;
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); dismiss(); return; }
        if (event.key === 'Tab') dismiss();
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || (open && (event.key === 'Home' || event.key === 'End'))) {
          event.preventDefault(); setOpen(true);
          const index = event.key === 'Home' ? 0 : event.key === 'End' ? matches.length - 1
            : (active + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
          setActive(index);
          return;
        }
        if (event.key === 'Enter' && open && active >= 0) { event.preventDefault(); choose(active); return; }
        onKeyDown?.(event);
      }} />
    {open && matches.length > 0 && <DropdownSurface anchor={input} onDismiss={dismiss} id={id} role="listbox" aria-label="Reference suggestions"
      onPointerDown={event => event.preventDefault()}>
      {matches.map((option, index) => <div key={option} id={`${id}-${index}`} role="option" aria-selected={value === option} data-active={active === index}
        className={styles.row} onPointerMove={() => setActive(index)} onClick={() => choose(index)}>
        <FileText size={17} className={styles.icon} aria-hidden="true" /><span className={styles.label}>{option}</span>
      </div>)}
    </DropdownSurface>}
  </span>;
}
