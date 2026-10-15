'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { DropdownSurface } from './dropdown-surface';
import styles from './dropdown.module.css';

type Item = { label: string; icon: ReactNode; href?: string; onSelect: () => void; disabled?: boolean; destructive?: boolean };
export function AdminActionMenu({ anchor, onClose, items, label }: {
  anchor: RefObject<HTMLButtonElement | null>; onClose: () => void; items: readonly Item[]; label: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const dismiss = useCallback(() => onClose(), [onClose]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => root.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])')?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, []);
  return <DropdownSurface anchor={anchor} onDismiss={dismiss} width={180} role="menu" aria-label={label} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); anchor.current?.focus({ preventScroll: true }); return; }
    if (event.key === 'Tab') { onClose(); anchor.current?.focus({ preventScroll: true }); return; }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const controls = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled):not([aria-disabled="true"])') ?? []);
    const current = controls.findIndex(control => control === document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + controls.length) % controls.length;
    event.preventDefault(); controls[next]?.focus({ preventScroll: true });
  }}>
    <div ref={root}>{items.map(item => {
      const content = <><span className={styles.icon} aria-hidden="true">{item.icon}</span><span>{item.label}</span></>;
      const className = `${styles.row} ${item.destructive ? styles.destructive : ''}`;
      return item.href ? <Link key={item.label} href={item.href} role="menuitem" tabIndex={-1} aria-disabled={item.disabled || undefined} className={className}
        onClick={event => { if (item.disabled) event.preventDefault(); else item.onSelect(); }}>{content}</Link>
        : <button key={item.label} type="button" role="menuitem" tabIndex={-1} disabled={item.disabled} className={className} onClick={item.onSelect}>{content}</button>;
    })}</div>
  </DropdownSurface>;
}
