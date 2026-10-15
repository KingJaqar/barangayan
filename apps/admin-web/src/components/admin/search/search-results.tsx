'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Search, ArrowLeft, ArrowRight } from 'lucide-react';
import { useAdminSearch } from '@/hooks/use-admin-search';
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH, SEARCH_CATEGORIES, normalizeQuery, searchUrl, type SearchFilter } from '@/lib/search/model';
import { Spinner } from '@/components/loading/spinner';
import { HitPreview } from './search-hit';
import { SearchSkeleton } from './search-skeleton';
import styles from './search.module.css';

export function SearchResults({ query, category, page }: { query: string; category: SearchFilter; page: number }) {
  const router = useRouter();
  const [draft, setDraft] = useState(query);
  const search = useAdminSearch(query, { category, page });
  const counts = new Map(search.data?.groups.map(group => [group.category, group.total]));
  const failed = search.data?.groups.filter(group => group.unavailable) ?? [];
  const groups = search.data?.groups.filter(group => category === 'all' ? group.hits.length > 0 : group.category === category) ?? [];
  const selected = search.data?.groups.find(group => group.category === category);
  const total = category === 'all' ? search.data?.total ?? 0 : selected?.total ?? 0;
  const currentPage = search.data?.page ?? page;
  return <div className={styles.page}>
    <div className={styles.pageHeading}><div><p className={styles.eyebrow}>Your barangay workspace</p><h1>Search results</h1>
      <p>Find the people and records you need, all in one place.</p></div></div>
    <form role="search" aria-label="Search results query" className={styles.pageSearch} onSubmit={event => {
      event.preventDefault(); router.push(searchUrl(normalizeQuery(draft)));
    }}><Search size={20} aria-hidden="true" /><input aria-label="Search all admin content" maxLength={MAX_QUERY_LENGTH} value={draft}
      placeholder="Name, reference number, or keyword" onChange={event => setDraft(event.target.value)} />
      <button type="submit">Search</button></form>
    <div className={styles.workspace}>
      <nav aria-label="Search categories" className={styles.filters}>
        <h2>Filter results</h2><Link prefetch={false} aria-current={category === 'all' ? 'page' : undefined} href={searchUrl(query)}>
          All results {search.data ? <span>{search.data.total}</span> : null}</Link>
        {SEARCH_CATEGORIES.map(item => <Link prefetch={false} key={item.id} href={searchUrl(query, item.id)} aria-current={category === item.id ? 'page' : undefined}>
          {item.label}{search.data ? <span>{search.data.groups.find(group => group.category === item.id)?.unavailable ? '—' : counts.get(item.id) ?? 0}</span> : null}</Link>)}
      </nav>
      <section aria-label="Search results" className={styles.results} aria-busy={search.loading}>
        <div className={styles.resultsStatus} role="status" aria-live="polite">
          {query.length < MIN_QUERY_LENGTH ? 'Enter at least 2 characters to begin.' : search.loading ? <><Spinner size="compact" /> Searching your barangay…</>
            : search.error ? search.error : `${failed.length ? 'Showing available' : total.toLocaleString()} results for “${query}”`}
        </div>
        {search.error ? <div className={styles.empty}><Search size={32} aria-hidden="true" /><h2>Search is unavailable</h2><p>{search.error}</p>
          {search.denied ? <Link href="/login">Sign in</Link> : <button type="button" onClick={search.retry}>Try again</button>}</div>
          : query.length < MIN_QUERY_LENGTH ? <div className={styles.empty}><Search size={32} aria-hidden="true" /><h2>What are you looking for?</h2>
            <p>Search a resident name, request number, incident, announcement, or service.</p></div>
          : search.loading ? <SearchSkeleton />
          : <>
            {failed.length ? <div className={styles.warning} role="alert"><p>Could not load {failed.map(group => SEARCH_CATEGORIES.find(item => item.id === group.category)!.label).join(', ')}.</p>
              <button type="button" onClick={search.retry}>Retry search</button></div> : null}
            {groups.map(group => <section key={group.category} className={styles.group} aria-label={SEARCH_CATEGORIES.find(item => item.id === group.category)!.label}>
              <div className={styles.groupHeading}><h2>{SEARCH_CATEGORIES.find(item => item.id === group.category)!.label} <span>{group.total}</span></h2>
                {category === 'all' && group.total > group.hits.length ? <Link prefetch={false} href={searchUrl(query, group.category)}>See all <ArrowRight size={15} aria-hidden="true" /></Link> : null}</div>
              {group.hits.map(hit => <Link prefetch={false} key={hit.id} href={hit.href} className={styles.resultCard}><HitPreview hit={hit} query={query} /></Link>)}
            </section>)}
            {total === 0 && !failed.length ? <div className={styles.empty}><Search size={32} aria-hidden="true" /><h2>No results found</h2>
              <p>Try a shorter keyword, check the spelling, or choose another category.</p>{category !== 'all' ? <Link href={searchUrl(query)}>Search all categories</Link> : null}</div> : null}
            {category !== 'all' && !selected?.unavailable && total > 0 ? <nav className={styles.pagination} aria-label="Search result pages">
              {currentPage > 1 ? <Link prefetch={false} href={searchUrl(query, category, currentPage - 1)}><ArrowLeft size={16} aria-hidden="true" /> Previous</Link> : <span />}
              <span>Page {currentPage} of {Math.max(1, Math.ceil(total / 10))}</span>{search.data?.hasMore ? <Link prefetch={false} href={searchUrl(query, category, currentPage + 1)}>Next <ArrowRight size={16} aria-hidden="true" /></Link> : <span />}
            </nav> : null}
          </>}
      </section>
    </div>
  </div>;
}
