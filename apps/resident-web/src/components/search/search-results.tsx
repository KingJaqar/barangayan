'use client';

import { ArrowLeft, ArrowRight, Search, TriangleAlert } from 'lucide-react';
import Link from 'next/link';
import { useResidentSearch } from '@/hooks/use-resident-search';
import { SEARCH_CATEGORIES, searchHref, type SearchFilter } from '@/lib/search/types';
import { SearchInput, SEARCH_SHORTCUTS } from './search-input';
import styles from './search.module.css';
import { SEARCH_ICONS } from './search-icons';
import { ResultSkeleton } from './search-loading';
import { LoadingStatus } from '@/components/shared/loading-status';

function Highlight({ text, query }: { text: string; query: string }) {
  const terms = query.split(' ').filter(Boolean);
  if (!terms.length) return <>{text}</>;
  const pattern = new RegExp(`(${terms.map(term => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const matches = new Set(terms.map(term => term.toLocaleLowerCase()));
  return <>{text.split(pattern).map((part, index) => matches.has(part.toLocaleLowerCase()) ? <mark key={index} className={styles.highlight}>{part}</mark> : part)}</>;
}

export function SearchResults({ query, category, page, isAuthenticated }: { query: string; category: SearchFilter; page: number; isAuthenticated: boolean }) {
  const { data, loading, refreshing, error, errorAnnounced, retry } = useResidentSearch(query, { category, page });
  const categories = SEARCH_CATEGORIES.filter(({ key }) => isAuthenticated || (key !== 'requests' && key !== 'reports'));
  const total = data?.groups.reduce((sum, group) => sum + group.count, 0) ?? 0;
  const failed = data?.groups.filter(group => group.failed) ?? [];
  return (
    <div className={styles.page}>
      <Link href="/home" className={styles.textLink}><ArrowLeft aria-hidden size={15} /> Back to home</Link>
      <header className={styles.header}><div><h1>Search your barangay</h1><p>Find services, community updates, and answers in one place.</p></div><SearchInput initialQuery={query} onSearchAgain={retry} /></header>
      <div className={styles.layout}>
        <nav aria-label="Search filters" className={styles.filters}>
          <h2>Filter results</h2>
          {[{ key: 'all' as const, label: 'All results' }, ...categories].map(({ key, label }) => {
            const Icon = key === 'all' ? Search : SEARCH_ICONS[key];
            return <Link key={key} href={searchHref(query, key)} aria-current={category === key ? 'page' : undefined} className={category === key ? styles.activeFilter : undefined}><Icon aria-hidden size={18} strokeWidth={1.75} />{label}</Link>;
          })}
        </nav>
        <section className={styles.results} aria-label="Search results">
          <LoadingStatus active={loading} label={refreshing ? 'Updating results…' : `Searching for “${query}”…`} className={styles.resultStatus} />
          <p role="status" className={styles.resultStatus}>{!loading && data && query && !failed.length ? `${total} ${total === 1 ? 'result' : 'results'} for “${query}”` : data && failed.length && total > 0 ? `Showing available results for “${query}”` : ''}</p>
          {!query ? <div className={styles.empty}><Search aria-hidden size={32} /><h2>What are you looking for?</h2><p>Enter a service, topic, or request reference above to get started.</p><div className={styles.shortcuts}>{SEARCH_SHORTCUTS.map(({ href, label, Icon }) => <Link key={href} href={href}><Icon aria-hidden size={18} strokeWidth={1.75} />{label}<ArrowRight aria-hidden size={15} /></Link>)}</div></div> : null}
          {error || failed.length ? <div className={styles.error}><TriangleAlert aria-hidden size={20} /><div><p role={errorAnnounced ? undefined : 'alert'}>{error ?? `We couldn't load ${failed.map(group => SEARCH_CATEGORIES.find(c => c.key === group.category)!.label.toLowerCase()).join(', ')}.${total ? ' Other results are shown below.' : ' Please try again.'}`}</p>{error && data ? <p>Showing the last loaded results, which may be out of date.</p> : null}<button type="button" onClick={retry} className={styles.textLink}>Try again</button></div></div> : null}
          {loading && !data ? <div aria-label="Loading search results" aria-busy="true"><ResultSkeleton /></div> : null}
          {data && total === 0 && !failed.length && query ? <div className={styles.empty}><Search aria-hidden size={32} /><h2>No results found</h2><p>Try a shorter phrase, check the spelling, or choose another category.</p>{category !== 'all' ? <Link className={styles.textLink} href={searchHref(query)}>Search all categories <ArrowRight aria-hidden size={14} /></Link> : null}</div> : null}
          {data?.groups.filter(group => !group.failed && group.count > 0).map(group => {
            const label = SEARCH_CATEGORIES.find(c => c.key === group.category)!.label;
            const Icon = SEARCH_ICONS[group.category];
            return <section key={group.category} className={styles.group} aria-label={label}>
              <div className={styles.groupHeader}><h2>{label} <span>{group.count}</span></h2>{category === 'all' && group.count > group.results.length ? <Link className={styles.textLink} href={searchHref(query, group.category)}>See all <ArrowRight aria-hidden size={14} /></Link> : null}</div>
              <ul>{group.results.map(result => <li key={result.id}><Link href={result.href} prefetch={false} className={styles.result}><span className={styles.resultIcon}><Icon aria-hidden size={21} strokeWidth={1.75} /></span><div><h3><Highlight text={result.title} query={query} /></h3><p className={styles.meta}>{result.meta}</p>{result.preview ? <p className={styles.preview}><Highlight text={result.preview} query={query} /></p> : null}</div><ArrowRight aria-hidden size={17} className={styles.resultArrow} /></Link></li>)}</ul>
              {category !== 'all' ? <nav className={styles.pagination} aria-label="Result pages">{data.page > 1 ? <Link className={styles.textLink} href={searchHref(query, category, data.page - 1)}><ArrowLeft aria-hidden size={14} /> Previous</Link> : <span />}<span>Page {data.page} of {Math.max(1, Math.ceil(group.count / data.pageSize))}</span>{data.page * data.pageSize < group.count ? <Link className={styles.textLink} href={searchHref(query, category, data.page + 1)}>Next <ArrowRight aria-hidden size={14} /></Link> : <span />}</nav> : null}
            </section>;
          })}
        </section>
      </div>
    </div>
  );
}
