'use client';

import { Children, isValidElement, useCallback, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { SELECT_FIELD_ICONS, SELECT_OPTION_ICONS, type AdminSelectKind } from './select-iconography';
import { DropdownSurface } from './dropdown-surface';
import styles from './dropdown.module.css';

export type AdminSelectOption = { value: string; label: ReactNode; disabled?: boolean; icon?: ReactNode };
type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'value' | 'onChange' | 'children'> & {
  value: string | number; onValueChange: (value: string) => void; options?: readonly AdminSelectOption[];
  children?: ReactNode; name?: string; required?: boolean; form?: string; compact?: boolean;
  width?: 'auto' | 'full'; icon?: ReactNode; kind?: AdminSelectKind; ref?: Ref<HTMLButtonElement>;
};

function labelText(label: ReactNode): string {
  if (typeof label === 'string' || typeof label === 'number') return String(label);
  if (isValidElement<{ children?: ReactNode }>(label)) return labelText(label.props.children);
  return Children.toArray(label).map(labelText).join('');
}

/** Accept existing option markup as well as explicit options; preserve data-driven labels and ordering. */
function childOptions(children: ReactNode): AdminSelectOption[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(child)) return [];
    if (child.type !== 'option') return childOptions(child.props.children);
    return [{ value: String(child.props.value ?? labelText(child.props.children)), label: child.props.children, disabled: child.props.disabled }];
  });
}

export function AdminSelect({ value, onValueChange, options: supplied, children, name, required, form, compact = false, width = 'full', icon, kind = 'category',
  ref, id: suppliedId, className = '', onKeyDown, onBlur, onClick, disabled, ...props }: Props) {
  const generated = useId();
  const id = suppliedId ?? generated;
  const listId = `${id}-list`;
  const trigger = useRef<HTMLButtonElement>(null);
  const backing = useRef<HTMLSelectElement>(null);
  const initial = useRef(String(value));
  const [open, setOpen] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [activeValue, setActiveValue] = useState<string | null>(null);
  const [error, setError] = useState('');
  const search = useRef({ text: '', time: 0 });
  const options = supplied ?? childOptions(children);
  const selected = options.findIndex(option => option.value === String(value));
  const active = options.findIndex(option => option.value === activeValue && !option.disabled);
  const Icon = SELECT_FIELD_ICONS[kind];
  const optionIcons = SELECT_OPTION_ICONS[kind];
  const SelectedIcon = optionIcons && Object.hasOwn(optionIcons, String(value)) ? optionIcons[String(value)] : undefined;
  function setActive(index: number) { setActiveValue(options[index]?.value ?? null); }
  const close = useCallback(() => { if (open) setExiting(true); setOpen(false); search.current = { text: '', time: 0 }; }, [open]);

  useEffect(() => {
    if (!exiting) return;
    const timer = setTimeout(() => setExiting(false), 160);
    return () => clearTimeout(timer);
  }, [exiting]);
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(`${listId}-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active, open, listId]);
  useEffect(() => {
    const native = backing.current;
    const reset = () => { setError(''); close(); if (String(value) !== initial.current) onValueChange(initial.current); };
    native?.form?.addEventListener('reset', reset);
    return () => native?.form?.removeEventListener('reset', reset);
  }, [close, onValueChange, value]);

  function show() {
    if (trigger.current?.matches(':disabled')) return;
    search.current = { text: '', time: 0 };
    setActive(selected >= 0 && !options[selected]?.disabled ? selected : options.findIndex(option => !option.disabled));
    setExiting(false); setOpen(true);
  }
  function choose(index: number) {
    const option = options[index];
    if (!option || option.disabled || trigger.current?.matches(':disabled')) return;
    close(); setError('');
    trigger.current?.focus({ preventScroll: true });
    if (option.value !== String(value)) onValueChange(option.value);
  }
  const visibleError = required && (selected < 0 || String(value) === '') ? error : '';
  const described = [props['aria-describedby'], visibleError ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  return <span className={`${styles.root} ${compact ? styles.compact : ''}`} data-width={width}>
    <button {...props} ref={element => {
      trigger.current = element;
      if (typeof ref === 'function') ref(element); else if (ref) ref.current = element;
    }} id={id} type="button" role="combobox" data-admin-select-trigger disabled={disabled} form={form}
      className={`${className} ${styles.trigger}`} aria-haspopup="listbox" aria-expanded={open}
      aria-controls={open ? listId : undefined} aria-activedescendant={open && options[active] ? `${listId}-${active}` : undefined}
      aria-required={required} aria-invalid={!!visibleError || props['aria-invalid']} aria-describedby={described}
      onClick={event => { onClick?.(event); if (!event.defaultPrevented) { if (open) close(); else show(); } }}
      onBlur={event => { close(); onBlur?.(event); }}
      onKeyDown={event => {
        if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); close(); return; }
        if (event.key === 'Tab') { close(); onKeyDown?.(event); return; }
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
          event.preventDefault(); event.stopPropagation();
          if (!open) show();
          const enabled = options.flatMap((option, index) => option.disabled ? [] : [index]);
          const current = enabled.indexOf(open ? active : selected);
          const next = event.key === 'Home' ? enabled[0] : event.key === 'End' ? enabled.at(-1)
            : !open && current >= 0 ? selected : enabled[(current + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length];
          setActive(next ?? -1); return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          if (open) { event.preventDefault(); event.stopPropagation(); choose(active); return; }
          if (event.key === ' ') { event.preventDefault(); show(); return; }
          if (onKeyDown) onKeyDown(event); else show();
          event.preventDefault();
          return;
        }
        if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
          event.preventDefault();
          const prefix = (open && Date.now() - search.current.time < 700 ? search.current.text : '') + event.key.toLowerCase();
          if (!open) show();
          search.current = { text: prefix, time: Date.now() };
          const match = options.findIndex(option => !option.disabled && labelText(option.label).trim().toLowerCase().startsWith(prefix));
          if (match >= 0) setActive(match);
          return;
        }
        onKeyDown?.(event);
      }}>
      <span className={styles.icon} aria-hidden="true">{icon ?? options[selected]?.icon ?? (SelectedIcon ? <SelectedIcon size={17} /> : <Icon size={17} />)}</span>
      <span className={styles.label}>{options[selected]?.label ?? (value ? String(value) : 'Select…')}</span>
      <ChevronDown size={15} aria-hidden="true" className={styles.chevron} />
    </button>
    <select ref={backing} className={styles.backing} data-admin-select-backing tabIndex={-1} aria-hidden="true" name={name} form={form}
      style={{ top: 0, left: 0, width: 1, maxWidth: 1, minWidth: 0, height: 1, minHeight: 0, padding: 0, margin: 0, border: 0 }}
      value={selected < 0 ? '' : String(value)} required={required} disabled={disabled}
      onChange={event => { setError(''); if (event.target.value !== String(value)) onValueChange(event.target.value); }}
      onFocus={() => trigger.current?.focus({ preventScroll: true })}
      onInvalid={event => {
        event.preventDefault();
        const native = event.currentTarget;
        setError(native.validationMessage);
        const first = native.form?.querySelector('input:invalid, select:invalid, textarea:invalid') ?? native;
        if (first === native) trigger.current?.focus({ preventScroll: true });
      }}>
      {selected < 0 && <option value="" />}
      {options.map((option, index) => <option key={`${option.value}-${index}`} value={option.value} disabled={option.disabled}>{labelText(option.label)}</option>)}
    </select>
    {visibleError && <span id={`${id}-error`} className={styles.error} role="alert">{visibleError}</span>}
    {(open || exiting) && <DropdownSurface anchor={trigger} open={open} onDismiss={close} id={listId} role="listbox"
      aria-label={props['aria-label']} aria-labelledby={props['aria-labelledby'] ?? id}
      className={compact ? styles.compact : ''} onPointerDown={event => event.preventDefault()}>
      {options.length ? options.map((option, index) => {
        // Data-driven and unknown values keep the gutter without an invented icon.
        const OptionIcon = optionIcons && Object.hasOwn(optionIcons, option.value) ? optionIcons[option.value] : undefined;
        return <div key={`${option.value}-${index}`} id={`${listId}-${index}`} role="option"
        aria-selected={String(value) === option.value} aria-disabled={option.disabled || undefined} data-active={active === index}
        className={styles.row} onPointerMove={() => { if (!option.disabled) setActive(index); }} onClick={() => choose(index)}>
        <span className={styles.icon} aria-hidden="true">{option.icon ?? (OptionIcon ? <OptionIcon size={17} /> : null)}</span>
        <span className={styles.label}>{option.label}</span>
        {String(value) === option.value && <Check size={16} aria-hidden="true" className={styles.check} />}
      </div>; }) : <div className={styles.row} role="status">No options available</div>}
    </DropdownSurface>}
  </span>;
}
