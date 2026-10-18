'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { BoundaryFitButton } from './BoundaryFitButton';
import styles from './incident-map.module.css';
import { notify } from '@/lib/notify';

interface MapViewportControlsProps {
  viewport: RefObject<HTMLElement | null>;
  boundary: GeoJSON.Polygon | GeoJSON.MultiPolygon | null;
  markers: { position: { lat: number; lng: number } }[];
  defaultCenter: { lat: number; lng: number };
  defaultZoom: number;
  boundaryLabel?: string;
}

export function MapViewportControls({ viewport, ...fitProps }: MapViewportControlsProps) {
  const map = useMap();
  const [nativeExpanded, setNativeExpanded] = useState(false);
  const [fallbackExpanded, setFallbackExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const button = useRef<HTMLButtonElement>(null);
  const controls = useRef<HTMLDivElement>(null);
  const expanded = nativeExpanded || fallbackExpanded;

  useEffect(() => {
    const target = viewport.current;
    let wasExpanded = false;
    const onChange = () => {
      const active = document.fullscreenElement === target;
      setNativeExpanded(active);
      map.invalidateSize({ pan: false });
      if (!active && wasExpanded) button.current?.focus({ preventScroll: true });
      wasExpanded = active;
    };
    document.addEventListener('fullscreenchange', onChange);
    if (controls.current) {
      L.DomEvent.disableClickPropagation(controls.current);
      L.DomEvent.disableScrollPropagation(controls.current);
    }
    return () => {
      document.removeEventListener('fullscreenchange', onChange);
      if (target && document.fullscreenElement === target) void document.exitFullscreen().catch(() => {});
    };
  }, [map, viewport]);

  useEffect(() => {
    const target = viewport.current;
    if (!nativeExpanded || !target) return;
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.fullscreenElement !== target) return;
      event.preventDefault();
      event.stopPropagation();
      void document.exitFullscreen().catch(() => {
        setError('Full screen could not close. Use the browser’s exit full screen control.');
        notify.error('Could not close full screen. Use the browser’s exit full screen control.');
      });
    };
    target.addEventListener('keydown', onEscape);
    return () => target.removeEventListener('keydown', onEscape);
  }, [nativeExpanded, viewport]);

  useEffect(() => {
    if (!fallbackExpanded) return;
    const target = viewport.current;
    if (!target) return;
    const trigger = button.current;
    const previousOverflow = document.body.style.overflow;
    const previousRole = target.getAttribute('role');
    const previousModal = target.getAttribute('aria-modal');
    const previousTabIndex = target.getAttribute('tabindex');
    const siblings: { node: HTMLElement; inert: boolean }[] = [];
    let branch: HTMLElement | null = target;
    while (branch?.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling !== branch && sibling instanceof HTMLElement) {
          siblings.push({ node: sibling, inert: sibling.inert });
          sibling.setAttribute('inert', '');
        }
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    target.setAttribute('data-expanded', 'true');
    target.setAttribute('role', 'dialog');
    target.setAttribute('aria-modal', 'true');
    target.setAttribute('tabindex', '-1');
    document.body.style.overflow = 'hidden';
    trigger?.focus({ preventScroll: true });
    map.invalidateSize({ pan: false });
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        setFallbackExpanded(false);
      }
      if (event.key === 'Tab') {
        const focusable = [...target.querySelectorAll<HTMLElement>('a[href],button,input,select,textarea,[tabindex]')]
          .filter(node => node.tabIndex >= 0 && !node.matches(':disabled') && !node.closest('[inert]') && node.getClientRects().length > 0);
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (!first) { event.preventDefault(); target.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === target)) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault(); first.focus();
        }
      }
    };
    target.addEventListener('keydown', onKey);
    return () => {
      target.removeEventListener('keydown', onKey);
      target.removeAttribute('data-expanded');
      for (const { node, inert } of siblings) node.toggleAttribute('inert', inert);
      for (const [name, value] of [['role', previousRole], ['aria-modal', previousModal], ['tabindex', previousTabIndex]]) {
        if (value === null) target.removeAttribute(name!);
        else target.setAttribute(name!, value!);
      }
      document.body.style.overflow = previousOverflow;
      map.invalidateSize({ pan: false });
      trigger?.focus({ preventScroll: true });
    };
  }, [fallbackExpanded, map, viewport]);

  async function toggleFullscreen() {
    const target = viewport.current;
    if (!target || pending) return;
    setError('');
    if (fallbackExpanded) { setFallbackExpanded(false); return; }
    setPending(true);
    try {
      if (document.fullscreenElement === target) await document.exitFullscreen();
      else if (document.fullscreenEnabled && target.requestFullscreen) {
        try { await target.requestFullscreen(); }
        catch { setFallbackExpanded(true); }
      } else setFallbackExpanded(true);
    } catch {
      setError('Full screen could not close. Press Escape to return to the page.');
      notify.error('Could not close full screen. Press Escape to return to the page.');
    } finally { setPending(false); }
  }

  return <div ref={controls} className={styles.viewportControls} role="group" aria-label="Map view controls">
    <BoundaryFitButton {...fitProps} />
    <button ref={button} type="button" className={styles.fullscreen} onClick={() => void toggleFullscreen()}
      disabled={pending} aria-busy={pending} aria-pressed={expanded}
      aria-label={expanded ? 'Exit map full screen' : 'View map full screen'} title={expanded ? 'Exit full screen (Esc)' : 'Full screen'}>
      {expanded ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
    </button>
    {error && <p className={styles.fullscreenError} role="alert">{error}</p>}
  </div>;
}
