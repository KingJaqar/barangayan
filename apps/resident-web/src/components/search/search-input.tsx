'use client';

import { ArrowRight, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition, type KeyboardEvent } from 'react';
import { useResidentSearch } from '@/hooks/use-resident-search';
import { normalizeSearchQuery, resultRelevance, SEARCH_CATEGORIES, searchHref } from '@/lib/search/types';
import { LoadingStatus } from '@/components/shared/loading-status';
import { Spinner } from '@/components/ui/loading';
import styles from './search.module.css';
import { SEARCH_ICONS } from './search-icons';
import { SuggestionSkeleton } from './search-loading';

export const SEARCH_SHORTCUTS = [
  { href: '/services/documents', label: 'Documents & services', Icon: SEARCH_ICONS.documents },
  { href: '/announcements', label: 'Announcements', Icon: SEARCH_ICONS.announcements },
  { href: '/health', label: 'Medical drives', Icon: SEARCH_ICONS.health },
  { href: '/settings/help', label: 'Help articles', Icon: SEARCH_ICONS.help },
];

export function SearchInput({ initialQuery = '', onSearchAgain }: { initialQuery?: string; onSearchAgain?: () => void }) {
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);
  const dropdown = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [menuHeight, setMenuHeight] = useState(440);
  const [navigating, startNavigation] = useTransition();
  const normalized = normalizeSearchQuery(query);
  const { data, loading, error, retry } = useResidentSearch(normalized, { suggestions: true, enabled: open && !composing });
  const suggestions = (data?.groups.flatMap(group => group.results) ?? []).sort((a, b) => resultRelevance(b, normalized) - resultRelevance(a, normalized)).slice(0, 6);
  const options = normalized ? [
    ...suggestions.map(result => ({ href: result.href, label: result.title, detail: SEARCH_CATEGORIES.find(category => category.key === result.category)!.label, Icon: SEARCH_ICONS[result.category] })),
    { href: searchHref(normalized), label: `See all results for “${normalized}”`, detail: 'Search your barangay', Icon: Search },
  ] : SEARCH_SHORTCUTS.map(shortcut => ({ href: shortcut.href, label: shortcut.label, detail: 'Browse', Icon: shortcut.Icon }));
  const activeOption = open ? options.findIndex(option => option.href === selection) : -1;
  const failed = data?.groups.filter(group => group.failed) ?? [];

  useEffect(() => {
    if (!open) return;
    const updateHeight = () => {
      const rect = input.current?.getBoundingClientRect();
      if (!rect) return;
      const viewport = window.visualViewport;
      setMenuHeight(Math.max(100, Math.min(440, (viewport?.height ?? window.innerHeight) + (viewport?.offsetTop ?? 0) - rect.bottom - 24)));
    };
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !wrapper.current?.contains(event.target)) { setOpen(false); setSelection(null); }
    };
    const frame = requestAnimationFrame(updateHeight);
    window.addEventListener('resize', updateHeight);
    window.addEventListener('scroll', updateHeight, true);
    window.visualViewport?.addEventListener('resize', updateHeight);
    document.addEventListener('pointerdown', outside);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateHeight);
      window.removeEventListener('scroll', updateHeight, true);
      window.visualViewport?.removeEventListener('resize', updateHeight);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open]);

  useEffect(() => {
    if (activeOption < 0) return;
    const element = document.getElementById(`${id}-${activeOption}`);
    const menu = dropdown.current;
    if (!element || !menu) return;
    const rect = element.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    if (rect.bottom > menuRect.bottom) menu.scrollTop += rect.bottom - menuRect.bottom + 8;
    if (rect.top < menuRect.top) menu.scrollTop -= menuRect.top - rect.top + 8;
  }, [activeOption, id]);

  function navigate(href: string) {
    setOpen(false); setSelection(null);
    startNavigation(() => router.push(href));
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing || composing || navigating) return;
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); setSelection(null); }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      const next = activeOption < 0 ? (event.key === 'ArrowDown' ? 0 : options.length - 1) : (activeOption + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      setSelection(options[next].href);
    }
    if (event.key === 'Enter' && activeOption >= 0) {
      event.preventDefault();
      navigate(options[activeOption].href);
    }
  }

  return (
    <div ref={wrapper} className={styles.inputWrap} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) { setOpen(false); setSelection(null); } }}>
      <form role="search" aria-label="Search your barangay" className={styles.form} onSubmit={event => {
        event.preventDefault();
        if (composing || navigating) return;
        if (onSearchAgain && normalized === initialQuery) { setOpen(false); setSelection(null); onSearchAgain(); }
        else navigate(searchHref(normalized));
      }}>
        <Search aria-hidden size={18} className={styles.searchIcon} />
        <input ref={input} type="search" role="combobox" aria-label="Search your barangay" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-options` : undefined} aria-activedescendant={activeOption >= 0 ? `${id}-${activeOption}` : undefined}
          autoComplete="off" maxLength={120} placeholder="Search your barangay…" value={query}
          onFocus={() => setOpen(true)} onKeyDown={onKeyDown} onCompositionStart={() => setComposing(true)} onCompositionEnd={() => setComposing(false)} onChange={event => { setQuery(event.target.value); setSelection(null); setOpen(true); }} />
        {query ? <button type="button" aria-label="Clear search" className={styles.clear} onClick={() => { setQuery(''); setSelection(null); input.current?.focus(); }}><X aria-hidden size={15} /></button> : null}
        <button type="submit" aria-label="Search" disabled={navigating} aria-busy={navigating || undefined} className={styles.submit}>{navigating ? <Spinner /> : <ArrowRight aria-hidden size={18} />}</button>
      </form>
      <LoadingStatus active={navigating} label="Opening search results…" className="sr-only" />
      {open ? (
        <div ref={dropdown} className={styles.dropdown} style={{ maxHeight: menuHeight }}>
          <p className={styles.dropdownLabel}>{normalized ? 'Search suggestions' : 'Explore your barangay'}</p>
          <LoadingStatus active={loading} label="Searching…" className={styles.suggestionStatus} />
          <div role="status" className={styles.message}>
            {!loading && !error && normalized && data && !suggestions.length && !failed.length ? 'No suggestions found. Try another word or see all results.' : ''}
          </div>
          {error || failed.length ? <div className={styles.message}><p role="alert">{error ?? 'Some suggestions are unavailable.'}</p><button type="button" onClick={retry} className={styles.textLink}>Try again</button></div> : null}
          {loading && !suggestions.length ? <SuggestionSkeleton /> : null}
          <ul id={`${id}-options`} role="listbox" aria-label="Search suggestions" aria-busy={loading || undefined}>
            {options.map((option, index) => <li key={option.href} role="presentation"><Link id={`${id}-${index}`} role="option" aria-selected={activeOption === index} href={option.href} prefetch={false} className={`${styles.option} ${activeOption === index ? styles.selected : ''}`} onClick={() => { setOpen(false); setSelection(null); }}>
              <option.Icon aria-hidden size={18} strokeWidth={1.75} /><span><strong>{option.label}</strong><small>{option.detail}</small></span><ArrowRight aria-hidden size={14} />
            </Link></li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
