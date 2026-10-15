'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Search, X, Clock, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useAdminSearch } from '@/hooks/use-admin-search';
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, SEARCH_CATEGORIES, normalizeQuery, rankedSuggestions, searchUrl } from '@/lib/search/model';
import { Spinner } from '@/components/loading/spinner';
import { HitPreview } from './search-hit';
import { SearchSkeleton } from './search-skeleton';
import styles from './search.module.css';
import dropdown from '../dropdown/dropdown.module.css';

export function NavbarSearch({ className, barangayId }: { className: string; barangayId: string }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [composing, setComposing] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const normalized = normalizeQuery(query);
  const valid = normalized.length >= MIN_QUERY_LENGTH;
  const search = useAdminSearch(normalized, { suggestions: true, enabled: open && !composing });
  const hits = search.data ? rankedSuggestions(search.data.groups, normalized) : [];
  const loading = valid && (composing || search.loading);
  const items = valid ? [{ href: searchUrl(normalized), term: normalized }, ...hits.map(hit => ({ href: hit.href, term: normalized }))]
    : normalized ? [] : recent.map(term => ({ href: searchUrl(term), term }));
  const selected = activeIndex < items.length ? activeIndex : -1;
  const storageKey = `barangayan:admin-search:v1:${barangayId}`;
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!wrapper.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);
  useEffect(() => {
    if (open && selected >= 0) document.getElementById(`${id}-${selected}`)?.scrollIntoView({ block: 'nearest' });
  }, [open, selected, id]);
  function remember(term: string) {
    const next = [term, ...recent.filter(item => item !== term)].slice(0, 5);
    setRecent(next);
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Search works without storage. */ }
  }
  function focus() {
    setOpen(true); setActiveIndex(-1);
    try {
      const stored: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]');
      setRecent(Array.isArray(stored) ? stored.filter((item): item is string => typeof item === 'string' && item.length >= 2 && item.length <= MAX_QUERY_LENGTH).slice(0, 5) : []);
    } catch { setRecent([]); }
  }
  function navigate(href: string, term: string) { if (term.length >= MIN_QUERY_LENGTH) remember(term); setOpen(false); setActiveIndex(-1); router.push(href); }
  function option(index: number) { return { id: `${id}-${index}`, role: 'option' as const, 'aria-selected': selected === index, tabIndex: -1 }; }
  return <div ref={wrapper} className={`${className} ${styles.navSearch}`} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <form role="search" aria-label="Admin search" onSubmit={event => {
      event.preventDefault(); navigate(normalized ? searchUrl(normalized) : '/search', normalized);
    }}>
      <Search className={styles.inputIcon} size={17} aria-hidden="true" />
      <input ref={input} role="combobox" aria-label="Search admin content" aria-autocomplete="list" aria-expanded={open}
        aria-controls={open ? `${id}-list` : undefined} aria-activedescendant={open && selected >= 0 ? `${id}-${selected}` : undefined}
        autoComplete="off" spellCheck={false} maxLength={MAX_QUERY_LENGTH} value={query} placeholder="Search residents, requests, incidents…" onFocus={focus} onClick={() => setOpen(true)}
        onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)}
        onChange={event => { setQuery(event.target.value); setActiveIndex(-1); setOpen(true); }} onKeyDown={event => {
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Escape') { event.preventDefault(); if (open) event.stopPropagation(); setOpen(false); setActiveIndex(-1); }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setOpen(true);
            if (items.length) setActiveIndex(event.key === 'ArrowDown' ? (selected + 1) % items.length : selected < 0 ? items.length - 1 : (selected - 1 + items.length) % items.length);
          }
          if (event.key === 'Enter' && open && selected >= 0) { event.preventDefault(); const item = items[selected]; navigate(item.href, item.term); }
        }} />
      <div className={styles.inputActions}>
        {query ? <button className={styles.clear} type="button" aria-label="Clear admin search" onClick={() => {
        setQuery(''); setActiveIndex(-1); input.current?.focus();
        }}><X size={16} aria-hidden="true" /></button> : null}
        <button className={styles.enter} type="submit" aria-label="Submit search and open search screen" title="Submit search"><CornerDownLeft size={16} aria-hidden="true" /></button>
      </div>
    </form>
    {open ? <div className={`${dropdown.surface} ${styles.popover}`}>
      <div className={styles.popoverHeading}><strong>{normalized ? 'Search Barangayan' : 'Recent searches'}</strong>
        {!normalized && recent.length ? <button type="button" onClick={() => { setRecent([]); try { sessionStorage.removeItem(storageKey); } catch {} }}>Clear history</button> : null}
      </div>
      <div id={`${id}-list`} role="listbox" aria-label="Search suggestions" aria-busy={loading} className={styles.suggestions}>
        {valid ? <Link {...option(0)} prefetch={false} href={searchUrl(normalized)} className={styles.suggestion} onClick={() => { remember(normalized); setOpen(false); }}>
          <span className={styles.icon}><Search size={19} aria-hidden="true" /></span><span className={styles.hitText}><strong>Search for “{normalized}”</strong><small>See all results</small></span><ArrowRight size={16} aria-hidden="true" />
        </Link> : null}
        {hits.map((hit, index) => <Link key={`${hit.category}:${hit.id}`} {...option(index + 1)} className={styles.suggestion}
          prefetch={false} href={hit.href} onClick={() => { remember(normalized); setOpen(false); }}>
          <span className={styles.suggestionContent}><small>{SEARCH_CATEGORIES.find(category => category.id === hit.category)!.label}</small>
            <span className={styles.hit}><HitPreview hit={hit} query={normalized} compact /></span></span>
        </Link>)}
        {loading ? <SearchSkeleton compact count={4} /> : null}
        {!normalized ? recent.map((term, index) => <Link key={term} {...option(index)} prefetch={false} href={searchUrl(term)} className={styles.suggestion}
          onClick={() => { remember(term); setOpen(false); }}><span className={styles.icon}><Clock size={19} aria-hidden="true" /></span><strong>{term}</strong></Link>) : null}
      </div>
      <div className={styles.popoverStatus} role="status" aria-live="polite">
        {!valid ? <p>{normalized ? 'Type at least 2 characters to search.' : 'Find people, requests, reports, and community content.'}</p>
          : loading ? <p><Spinner size="compact" /> Searching…</p>
          : search.error ? <><p>{search.error}</p>{search.denied ? <Link href="/login">Sign in</Link> : <button type="button" onClick={search.retry}>Try again</button>}</>
          : search.data?.groups.some(group => group.unavailable) ? <><p>Some categories could not load.</p><button type="button" onClick={search.retry}>Retry search</button></>
          : hits.length === 0 ? <p>No results for “{normalized}”. Try a name, reference number, or different keyword.</p>
          : <p>Use ↑ ↓ to choose a result, Enter to open, and Esc to close.</p>}
      </div>
    </div> : null}
  </div>;
}
