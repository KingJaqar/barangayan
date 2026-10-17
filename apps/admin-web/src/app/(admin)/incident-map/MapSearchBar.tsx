'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CornerDownLeft, MapPin, Search, X } from 'lucide-react';
import { useAdminSearch } from '@/hooks/use-admin-search';
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, normalizeQuery, rankedSuggestions } from '@/lib/search/model';
import { Spinner } from '@/components/loading/spinner';
import styles from './incident-map.module.css';

interface MapSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  layer: 'incidents' | 'evacuation';
  records: { id: string; label: string }[];
  onSelect: (id: string, title: string) => void;
}

export function MapSearchBar({ value, onChange, layer, records, onSelect }: MapSearchBarProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [composing, setComposing] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const query = normalizeQuery(value);
  const valid = query.length >= MIN_QUERY_LENGTH;
  const search = useAdminSearch(query, { category: layer === 'incidents' ? 'incidents' : 'centers', suggestions: true, enabled: open && !composing });
  const hits = search.data ? rankedSuggestions(search.data.groups, query) : [];
  const unavailable = search.data?.groups.some(group => group.unavailable);
  const selected = activeIndex < hits.length ? activeIndex : -1;
  const loading = valid && (search.loading || composing);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  function choose(index: number) {
    const hit = hits[index];
    if (!hit || !records.some(record => record.id === hit.id)) return;
    // Keep the full mapped label, rather than the search service's truncated title.
    onSelect(hit.id, records.find(record => record.id === hit.id)!.label);
    input.current?.focus({ preventScroll: true });
    setOpen(false);
    setActiveIndex(-1);
  }

  return <div ref={wrapper} className={styles.searchWrapper} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <form className={styles.search} role="search" aria-label="Search this map" onSubmit={event => {
      event.preventDefault();
      if (composing) return;
      if (selected >= 0) choose(selected);
      else { onChange(query); setOpen(false); }
    }}>
      <Search size={17} aria-hidden="true" />
      <input ref={input} role="combobox" aria-label={layer === 'incidents' ? 'Search incidents on map' : 'Search evacuation centers on map'}
        aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-results` : undefined}
        aria-activedescendant={open && selected >= 0 ? `${id}-${selected}` : undefined}
        autoComplete="off" spellCheck={false} maxLength={MAX_QUERY_LENGTH} value={value}
        placeholder={layer === 'incidents' ? 'Search incidents, places, reporters…' : 'Search evacuation centers…'}
        onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
        onChange={event => { onChange(event.target.value); setActiveIndex(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setActiveIndex(-1); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            const available = hits.map((hit, index) => records.some(record => record.id === hit.id) ? index : -1).filter(index => index >= 0);
            if (available.length) {
              const current = available.indexOf(selected);
              setActiveIndex(available[(current + (event.key === 'ArrowDown' ? 1 : current < 0 ? 0 : -1) + available.length) % available.length]);
            }
          }
        }} />
      {value && <button type="button" onClick={() => { onChange(''); setActiveIndex(-1); input.current?.focus(); }} className={styles.clear} aria-label="Clear map search"><X size={15} aria-hidden="true" /></button>}
      <button type="submit" className={styles.searchSubmit} aria-label="Apply search to map" title="Search this map"><CornerDownLeft size={16} aria-hidden="true" /></button>
    </form>
    {open && <div className={styles.searchPopover}>
      <div className={styles.searchHeading}>Search this map<span>{layer === 'incidents' ? 'Incidents' : 'Evacuation centers'}</span></div>
      <div id={`${id}-results`} role="listbox" aria-label="Map search results" aria-busy={loading}>
        {hits.map((hit, index) => {
          const mapped = records.some(record => record.id === hit.id);
          return <button type="button" role="option" key={hit.id} id={`${id}-${index}`} aria-selected={selected === index}
            aria-disabled={!mapped} disabled={!mapped} tabIndex={-1} className={styles.searchResult} onClick={() => choose(index)}>
            <MapPin size={16} aria-hidden="true" /><span><strong>{hit.title}</strong><small>{mapped ? hit.preview || hit.meta : 'No location in the current map layer'}</small></span>
          </button>;
        })}
      </div>
      <div className={styles.searchStatus} role="status" aria-live="polite">
        {!valid ? <p>Type at least 2 characters to find a location.</p>
          : loading ? <p><Spinner size="compact" /> Searching…</p>
          : search.error ? <><p>{search.error}</p>{!search.denied && <button type="button" onClick={search.retry}>Try again</button>}</>
          : unavailable ? <><p>Search is temporarily unavailable.</p><button type="button" onClick={search.retry}>Retry search</button></>
          : hits.length === 0 ? <p>No results for “{query}”. Try another keyword.</p>
          : <p>Choose a result to focus its marker. ↑ ↓ to select · Enter to open · Esc to close.</p>}
      </div>
    </div>}
  </div>;
}
