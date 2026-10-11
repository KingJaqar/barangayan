'use client';

import { useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useBrowseViewport } from './table-browse-panel';

function interactiveTarget(target: EventTarget | null, region: HTMLElement) {
  return target instanceof HTMLElement && target !== region &&
    !!target.closest('input,select,textarea,button,a,[contenteditable=true],[role=separator],[role=slider]');
}

export function TableScrollArea({ children }: { children: ReactNode }) {
  const { bounded, label, resetKey } = useBrowseViewport();
  const topRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const syncFrame = useRef(0);
  const [geometry, setGeometry] = useState({ track: 0, overflow: false, height: 400 });
  useLayoutEffect(() => {
    const body = bodyRef.current, top = topRef.current, root = rootRef.current;
    const table = body?.firstElementChild;
    if (!body || !top || !root || !table) return;
    let frame = 0, disposed = false;
    function measure() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (disposed) return;
        const max = Math.max(0, body!.scrollWidth - body!.clientWidth);
        const footer = root!.closest('.table-browse-panel')?.querySelector('[data-browse-footer]');
        const anchor = root!.closest('[data-admin-viewport]');
        const bottom = Math.min(window.visualViewport?.height ?? window.innerHeight,
          anchor?.getBoundingClientRect().bottom ?? window.innerHeight);
        const height = Math.max(48, Math.floor(bottom - body!.getBoundingClientRect().top -
          (footer?.getBoundingClientRect().height ?? 0) - 32));
        const next = { track: top!.clientWidth + max, overflow: max > 1, height };
        setGeometry(prev => prev.track === next.track && prev.overflow === next.overflow && prev.height === next.height ? prev : next);
        if (body!.scrollLeft > max) body!.scrollLeft = max;
        if (Math.abs(top!.scrollLeft - body!.scrollLeft) > 0.5) top!.scrollLeft = body!.scrollLeft;
      });
    }
    const resize = new ResizeObserver(measure);
    const panel = root.closest('.table-browse-panel');
    for (const element of [table, body, top, panel, panel?.querySelector('[data-browse-controls]'),
      panel?.querySelector('[data-browse-footer]'), root.closest('[data-admin-viewport]')]) {
      if (element) resize.observe(element);
    }
    const mutation = new MutationObserver(measure);
    mutation.observe(table, { attributes: true, childList: true, subtree: true, characterData: true });
    window.addEventListener('resize', measure);
    window.visualViewport?.addEventListener('resize', measure);
    document.fonts?.addEventListener('loadingdone', measure);
    const wheel = (event: WheelEvent) => {
      if (!bounded || event.ctrlKey || event.metaKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? body.clientHeight : 1;
      body.scrollBy({ left: (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit,
        top: (event.shiftKey ? 0 : event.deltaY) * unit });
    };
    top.addEventListener('wheel', wheel, { passive: false });
    // Firefox fixture testing demonstrated diagonal boundary chaining despite CSS
    // containment. Cancel only boundary input, within this opt-in viewport.
    const boundaryWheel = (event: WheelEvent) => {
      if (!bounded || event.ctrlKey || event.metaKey) return;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? body.clientHeight : 1;
      const dx = (event.deltaX + (event.shiftKey ? event.deltaY : 0)) * unit;
      const dy = (event.shiftKey ? 0 : event.deltaY) * unit;
      const canMove = (element: HTMLElement, horizontal: boolean, delta: number) => {
        const offset = horizontal ? element.scrollLeft : element.scrollTop;
        const max = horizontal ? element.scrollWidth - element.clientWidth : element.scrollHeight - element.clientHeight;
        return delta < 0 ? offset > 0 : delta > 0 ? offset < max - 1 : false;
      };
      let nested = event.target instanceof HTMLElement ? event.target : null;
      while (nested && nested !== body) {
        if ((canMove(nested, false, dy) && /auto|scroll/.test(getComputedStyle(nested).overflowY)) ||
          (canMove(nested, true, dx) && /auto|scroll/.test(getComputedStyle(nested).overflowX))) return;
        nested = nested.parentElement;
      }
      if ((dx !== 0 && !canMove(body, true, dx)) || (dy !== 0 && !canMove(body, false, dy))) {
        event.preventDefault();
        body.scrollBy({ left: dx, top: dy });
      }
    };
    body.addEventListener('wheel', boundaryWheel, { passive: false });
    measure();
    return () => {
      disposed = true; cancelAnimationFrame(frame); cancelAnimationFrame(syncFrame.current);
      resize.disconnect(); mutation.disconnect();
      window.removeEventListener('resize', measure);
      window.visualViewport?.removeEventListener('resize', measure);
      document.fonts?.removeEventListener('loadingdone', measure);
      top.removeEventListener('wheel', wheel);
      body.removeEventListener('wheel', boundaryWheel);
    };
  }, [bounded]);
  useLayoutEffect(() => {
    if (bounded && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [bounded, resetKey]);
  function sync(fromTop: boolean) {
    cancelAnimationFrame(syncFrame.current);
    syncFrame.current = requestAnimationFrame(() => {
      const from = fromTop ? topRef.current : bodyRef.current, to = fromTop ? bodyRef.current : topRef.current;
      if (from && to && Math.abs(from.scrollLeft - to.scrollLeft) > 0.5) to.scrollLeft = from.scrollLeft;
    });
  }
  function keyScroll(event: KeyboardEvent<HTMLDivElement>, horizontalOnly = false) {
    if (!bounded || event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || interactiveTarget(event.target, event.currentTarget)) return;
    const body = bodyRef.current;
    if (!body) return;
    let left = 0, top = 0;
    const step = Math.max(1, body.clientHeight - (body.querySelector('thead')?.getBoundingClientRect().height ?? 0));
    switch (event.key) {
      case 'ArrowLeft': left = -48; break;
      case 'ArrowRight': left = 48; break;
      case 'ArrowUp': top = -48; break;
      case 'ArrowDown': top = 48; break;
      case 'PageUp': top = -step; break;
      case 'PageDown': top = step; break;
      case ' ': top = event.shiftKey ? -step : step; break;
      case 'Home': if (horizontalOnly) left = -body.scrollWidth; else top = -body.scrollHeight; break;
      case 'End': if (horizontalOnly) left = body.scrollWidth; else top = body.scrollHeight; break;
      default: return;
    }
    event.preventDefault(); body.scrollBy({ left, top });
  }
  return <div ref={rootRef} className={bounded ? 'table-browse-scroll' : undefined}>
    {bounded && geometry.overflow && <div className="table-browse-column-controls" aria-label="Column scrolling">
      <button type="button" onClick={() => bodyRef.current?.scrollBy({ left: -Math.max(48, bodyRef.current.clientWidth * 0.8) })}>Scroll columns left</button>
      <button type="button" onClick={() => bodyRef.current?.scrollBy({ left: Math.max(48, bodyRef.current.clientWidth * 0.8) })}>Scroll columns right</button>
    </div>}
    <div ref={topRef} onScroll={() => sync(true)} onKeyDown={event => keyScroll(event, true)}
      role={bounded ? 'region' : undefined} aria-label={bounded ? `${label} horizontal scroll` : undefined}
      tabIndex={bounded && geometry.overflow ? 0 : undefined}
      className={`overflow-x-auto overflow-y-hidden ${bounded ? 'table-browse-strip' : ''}`} style={{ height: 16 }}>
      <div style={{ width: geometry.track, height: 1 }} />
    </div>
    <div ref={bodyRef} onScroll={() => sync(false)} onKeyDown={event => keyScroll(event)}
      role={bounded ? 'region' : undefined} aria-label={bounded ? `${label} rows and columns` : undefined}
      tabIndex={bounded ? 0 : undefined}
      className={`w-full overflow-x-auto rounded-xl border border-black/10 dark:border-white/10 ${bounded ? 'table-browse-viewport' : ''}`}
      style={bounded ? { maxHeight: geometry.height } : undefined}>{children}</div>
  </div>;
}
