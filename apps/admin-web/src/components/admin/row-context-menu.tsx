'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import dropdown from './dropdown/dropdown.module.css';

const OPEN_EVENT = 'admin-row-context-menu-open';
type ActionControl = HTMLButtonElement | HTMLAnchorElement;
type MenuAction = { control: ActionControl; label: string; disabled: boolean };

function availableActions(cell: HTMLElement): MenuAction[] {
  // The mounted Actions controls are the source of truth, including local confirmation
  // and pending state. Activating them reuses their handlers without mounting a second
  // copy of a stateful action or duplicating the screen's permissions and status rules.
  return Array.from(cell.querySelectorAll<ActionControl>('button, a[href]')).flatMap(control => {
    const style = getComputedStyle(control);
    const menuOnly = control.hasAttribute('data-context-menu-only');
    if (control.closest('[inert], [aria-hidden="true"]') || (!menuOnly && (control.closest('[hidden]') || !control.getClientRects().length
      || style.visibility === 'hidden' || style.visibility === 'collapse'))) return [];
    // Loading controls keep an invisible pending label mounted beside the current
    // label. Exclude that content, while retaining screen-reader-only action text.
    const labelContent = control.cloneNode(true) as HTMLElement;
    labelContent.querySelectorAll('[aria-hidden="true"], [hidden]').forEach(node => node.remove());
    const label = (control.dataset.contextMenuLabel || control.getAttribute('aria-label') || labelContent.textContent || control.title).trim();
    if (!label) return [];
    return [{ control, label, disabled: control.matches(':disabled') || !!control.closest('[aria-disabled="true"]') }];
  });
}

export function useRowContextMenu() {
  const [selection, setSelection] = useState<{ rowKey: string; cell: HTMLElement; x: number; y: number; actions: MenuAction[] } | null>(null);
  const close = useCallback(() => setSelection(null), []);
  useEffect(() => {
    window.addEventListener(OPEN_EVENT, close);
    return () => window.removeEventListener(OPEN_EVENT, close);
  }, [close]);

  function open(event: MouseEvent<HTMLTableRowElement>, rowKey: string) {
    const cell = event.currentTarget.querySelector<HTMLElement>('[data-context-menu-actions]');
    if (!cell) return;
    const actions = availableActions(cell);
    if (!actions.length) return;
    event.preventDefault();
    event.stopPropagation();
    window.dispatchEvent(new Event(OPEN_EVENT));
    setSelection({ rowKey, cell, x: event.clientX, y: event.clientY, actions });
  }

  return { open, activeRowKey: selection?.rowKey, menu: selection && <RowContextMenu selection={selection} onClose={close} /> };
}

function RowContextMenu({ selection, onClose }: {
  selection: { cell: HTMLElement; x: number; y: number; actions: MenuAction[] }; onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const previousFocus = useRef(typeof document !== 'undefined' ? document.activeElement : null);
  const { cell, x, y, actions } = selection;

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    const bounds = menu.getBoundingClientRect();
    const margin = 8;
    menu.style.left = `${Math.max(margin, Math.min(x, window.innerWidth - bounds.width - margin))}px`;
    menu.style.top = `${Math.max(margin, Math.min(y, window.innerHeight - bounds.height - margin))}px`;
  }, [x, y, actions]);

  useEffect(() => {
    function outside(event: Event) {
      if (!(event.target instanceof Node) || !menuRef.current?.contains(event.target)) onClose();
    }
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopPropagation();
        onClose();
        if (previousFocus.current instanceof HTMLElement && previousFocus.current.isConnected) previousFocus.current.focus({ preventScroll: true });
        return;
      }
      if (event.key === 'Tab') { onClose(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!items.length) return;
      event.preventDefault(); event.stopPropagation();
      const current = items.findIndex(item => item === document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
        : event.key === 'ArrowDown' ? (current + 1) % items.length : (current <= 0 ? items.length : current) - 1;
      items[next].focus({ preventScroll: true });
    }
    // Close when the table changes so removed/disabled actions cannot remain stale.
    // The portal is outside the table and cannot trigger this observer. Ancestor
    // attributes also cover a pending/inert browse panel or disabled fieldset.
    const observer = new MutationObserver(records => {
      // Moving the menu updates the row highlight; that UI-only attribute must not
      // dismiss the new menu. All other table changes still invalidate its actions.
      if (records.some(record => record.type !== 'attributes' || record.attributeName !== 'data-context-menu-open')) onClose();
    });
    const table = cell.closest('table');
    if (table) observer.observe(table, { subtree: true, childList: true, attributes: true, characterData: true });
    for (let parent = table?.parentElement; parent; parent = parent.parentElement) {
      observer.observe(parent, { attributes: true, attributeFilter: ['disabled', 'aria-disabled', 'hidden', 'inert', 'class', 'style'] });
    }
    document.addEventListener('pointerdown', outside, true);
    document.addEventListener('click', outside, true);
    document.addEventListener('contextmenu', outside, true);
    document.addEventListener('keydown', keydown, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('scroll', outside, true);
    window.addEventListener('blur', onClose);
    return () => {
      observer.disconnect();
      document.removeEventListener('pointerdown', outside, true);
      document.removeEventListener('click', outside, true);
      document.removeEventListener('contextmenu', outside, true);
      document.removeEventListener('keydown', keydown, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('scroll', outside, true);
      window.removeEventListener('blur', onClose);
    };
  }, [cell, onClose]);

  return createPortal(<div ref={menuRef} role="menu" aria-label="Row actions"
    style={{ position: 'fixed', left: x, top: y, zIndex: 100, minWidth: 'min(12rem, calc(100vw - 16px))', maxWidth: 'calc(100vw - 16px)', maxHeight: 'calc(100vh - 16px)', overflowY: 'auto' }}
    className={dropdown.surface}
    onClick={event => event.stopPropagation()} onContextMenu={event => { event.preventDefault(); event.stopPropagation(); }}>
    {actions.map(({ control, label, disabled }, index) => <button key={index} type="button" role="menuitem" tabIndex={-1}
      disabled={disabled} title={control.title || undefined}
      className={dropdown.row}
      onClick={() => {
        onClose();
        const current = availableActions(cell).find(action => action.control === control);
        if (!control.isConnected || !current || current.disabled) return;
        // Keep inline confirmations and cancellation forms reachable in wide tables.
        if (!control.closest('[data-record-actions]')) control.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        if (!control.hidden) control.focus({ preventScroll: true });
        control.click();
      }}><ActionIcon control={control} /><span>{label}</span></button>)}
  </div>, document.body);
}

function ActionIcon({ control }: { control: ActionControl }) {
  const iconRef = useRef<HTMLSpanElement>(null);
  useLayoutEffect(() => {
    const source = Array.from(control.querySelectorAll('svg')).find(svg => {
      if (control.hasAttribute('data-context-menu-only')) return true;
      if (!svg.getClientRects().length) return false;
      for (let element: Element | null = svg; element && element !== control; element = element.parentElement) {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      }
      return true;
    });
    if (!source) { iconRef.current?.replaceChildren(); return; }
    // Copy the button's SVG rather than maintaining a separate action-to-icon map.
    const icon = source.cloneNode(true) as SVGSVGElement;
    icon.setAttribute('aria-hidden', 'true');
    icon.setAttribute('focusable', 'false');
    icon.style.width = '16px';
    icon.style.height = '16px';
    const color = getComputedStyle(source).color;
    const background = getComputedStyle(control).backgroundColor;
    // Preserve colored button icons. For white icons on solid buttons, use the
    // button's background hue blended toward the menu foreground for contrast.
    icon.style.color = color === 'rgb(255, 255, 255)' && background !== 'rgba(0, 0, 0, 0)'
      ? `color-mix(in srgb, ${background} 65%, currentColor)` : color;
    iconRef.current?.replaceChildren(icon);
  }, [control]);
  return <span ref={iconRef} aria-hidden="true" className="inline-flex h-4 w-4 shrink-0 items-center justify-center" />;
}
