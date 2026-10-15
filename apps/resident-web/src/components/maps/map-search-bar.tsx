'use client';

import { ArrowUpRight, MapPin, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import styles from './maps.module.css';

export type MapSearchResult = { id: string; label: string; detail: string };

export function MapSearchBar({ value, onChange, results = [], onSelect, placeholder = 'Search incidents…', recommendationLabel = 'Recommended places' }: {
  value: string;
  onChange: (value: string) => void;
  results?: MapSearchResult[];
  onSelect?: (id: string) => void;
  placeholder?: string;
  recommendationLabel?: string;
}) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestions = results.slice(0, 6);
  const hasQuery = value.trim().length > 0;
  const expanded = !!onSelect && open;
  const activeResult = suggestions[activeIndex];

  useEffect(() => {
    if (expanded && activeIndex >= 0) listRef.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [expanded, activeIndex]);

  function select(resultId: string) {
    onSelect?.(resultId);
    setOpen(false);
    setActiveIndex(-1);
  }

  return (
    <div className={styles.searchWrap} onBlur={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <div className={styles.search}>
        <Search size={18} aria-hidden />
        <input ref={inputRef} type={onSelect ? 'text' : 'search'} role={onSelect ? 'combobox' : undefined} autoComplete="off"
          value={value} placeholder={placeholder} aria-label={placeholder.replace('…', '')}
          aria-expanded={onSelect ? expanded : undefined} aria-controls={expanded ? `${id}-results` : undefined}
          aria-autocomplete={onSelect ? 'list' : undefined} aria-describedby={expanded ? `${id}-status` : undefined}
          aria-activedescendant={expanded && activeResult ? `${id}-${activeResult.id}` : undefined}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onChange={(event) => { onChange(event.target.value); setActiveIndex(-1); setOpen(true); }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') { setOpen(false); setActiveIndex(-1); }
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
              if (suggestions.length) setActiveIndex((index) => event.key === 'ArrowDown'
                ? (index + 1) % suggestions.length : (index <= 0 ? suggestions.length - 1 : index - 1));
            }
            if (event.key === 'Enter' && suggestions.length && !event.nativeEvent.isComposing) {
              event.preventDefault();
              select((activeResult ?? suggestions[0]).id);
            }
          }} />
        {value ? <button type="button" className={styles.clearSearch} aria-label="Clear search"
          onClick={() => { onChange(''); setActiveIndex(-1); inputRef.current?.focus(); }}>
          <X size={16} aria-hidden />
        </button> : null}
      </div>
      {expanded ? <div className={styles.searchDropdown}>
        <p id={`${id}-status`} className={styles.searchStatus} role="status">
          {hasQuery
            ? (results.length ? `${results.length} ${results.length === 1 ? 'match' : 'matches'} · Select to view on map`
              : 'No matches. Try another name, category or street.')
            : (results.length ? `${recommendationLabel} · Select to view on map` : 'No recommendations available for this view.')}
        </p>
        <ul ref={listRef} id={`${id}-results`} role="listbox" aria-label="Map search results">
          {suggestions.map((result, index) => <li key={result.id} id={`${id}-${result.id}`}
            role="option" aria-selected={activeIndex === index} className={styles.searchResult}
            onMouseDown={(event) => event.preventDefault()} onClick={() => select(result.id)}
            onMouseEnter={() => setActiveIndex(index)}>
            <MapPin size={17} aria-hidden />
            <span><strong>{result.label}</strong><small>{result.detail}</small></span>
            <ArrowUpRight size={15} aria-hidden />
          </li>)}
        </ul>
        {results.length > suggestions.length ? <p className={styles.searchHint}>
          {hasQuery ? 'Showing the first 6 matches. Keep typing to narrow your search.' : 'Start typing to search by name, category or street.'}
        </p> : null}
      </div> : null}
    </div>
  );
}
