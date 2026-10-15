'use client';

import { useEffect, useLayoutEffect, useRef, type HTMLAttributes, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import styles from './dropdown.module.css';

/** Mount only while open (or during the noninteractive exit). Native dialogs own their portals. */
export function DropdownSurface({ anchor, open = true, onDismiss, width, maxHeight, className = '', children, ...props }: HTMLAttributes<HTMLDivElement> & {
  anchor: RefObject<HTMLElement | null>; open?: boolean; onDismiss: () => void; width?: number; maxHeight?: number;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const owner = anchor.current?.closest('dialog, [role="dialog"]') ?? anchor.current?.ownerDocument.body;

  useLayoutEffect(() => {
    const trigger = anchor.current;
    const element = panel.current;
    if (!trigger || !element) return;
    const ancestors: HTMLElement[] = [];
    for (let parent: HTMLElement | null = trigger; parent; parent = parent.parentElement) ancestors.push(parent);
    function align() {
      if (!trigger || !element) return;
      if (!trigger.isConnected || trigger.matches(':disabled') || trigger.closest('[inert], [hidden]') || !trigger.getClientRects().length) { onDismiss(); return; }
      const rect = trigger.getBoundingClientRect();
      const margin = 8;
      const view = window.visualViewport;
      const leftEdge = view?.offsetLeft ?? 0;
      const topEdge = view?.offsetTop ?? 0;
      const viewWidth = view?.width ?? window.innerWidth;
      const viewHeight = view?.height ?? window.innerHeight;
      // CSS zoom scales a fixed child's coordinates too; browser zoom already uses CSS pixels.
      let scale = 1;
      for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) scale *= Number(getComputedStyle(parent).zoom) || 1;
      const panelWidth = Math.min(width ?? rect.width, viewWidth - margin * 2);
      const below = topEdge + viewHeight - rect.bottom - 7 - margin;
      const above = rect.top - topEdge - 7 - margin;
      const contentHeight = element.scrollHeight * scale;
      const flip = below < Math.min(contentHeight, 256) && above > below;
      const heightLimit = Math.max(44, Math.min(maxHeight ?? Math.min(320, viewHeight * .5), flip ? above : below));
      element.style.width = `${panelWidth / scale}px`;
      element.style.maxHeight = `${heightLimit / scale}px`;
      element.style.left = `${Math.max(leftEdge + margin, Math.min(rect.left, leftEdge + viewWidth - panelWidth - margin)) / scale}px`;
      element.style.top = `${(flip ? rect.top - 7 - Math.min(contentHeight, heightLimit) : rect.bottom + 7) / scale}px`;
    }
    align();
    let frame = 0;
    let deadline = performance.now() + 2500;
    function followMotion() {
      align();
      if (performance.now() < deadline && ancestors.some(parent => parent.getAnimations().some(animation => animation.playState === 'running'))) {
        frame = requestAnimationFrame(followMotion);
      }
    }
    function transition(event: TransitionEvent) {
      if (!(event.target instanceof HTMLElement) || !ancestors.includes(event.target)) return;
      cancelAnimationFrame(frame); deadline = performance.now() + 2500; followMotion();
    }
    followMotion();
    const resize = new ResizeObserver(align);
    resize.observe(trigger);
    resize.observe(element);
    // Parent animation, disabled fieldsets, or a closing sheet also invalidate the anchor.
    const mutation = new MutationObserver(align);
    for (let parent: HTMLElement | null = trigger; parent; parent = parent.parentElement) {
      mutation.observe(parent, { attributes: true, attributeFilter: ['disabled', 'hidden', 'inert', 'class', 'style', 'open'] });
    }
    window.addEventListener('transitionrun', transition, true);
    window.addEventListener('resize', align);
    window.addEventListener('scroll', align, true);
    window.visualViewport?.addEventListener('resize', align);
    window.visualViewport?.addEventListener('scroll', align);
    return () => {
      resize.disconnect(); mutation.disconnect();
      cancelAnimationFrame(frame); window.removeEventListener('transitionrun', transition, true);
      window.removeEventListener('resize', align); window.removeEventListener('scroll', align, true);
      window.visualViewport?.removeEventListener('resize', align); window.visualViewport?.removeEventListener('scroll', align);
    };
  }, [anchor, onDismiss, width, maxHeight]);

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !anchor.current?.contains(event.target) && !panel.current?.contains(event.target)) onDismiss();
    }
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [anchor, open, onDismiss]);

  if (!owner) return null;
  return createPortal(<div {...props} ref={panel} data-admin-dropdown-surface data-open={open} aria-hidden={!open || undefined} inert={!open}
    className={`${styles.surface} ${className}`} style={{ position: 'fixed', ...props.style }}
    onPointerDown={event => { event.stopPropagation(); props.onPointerDown?.(event); }}
    onClick={event => { event.stopPropagation(); props.onClick?.(event); }}>{children}</div>, owner);
}
