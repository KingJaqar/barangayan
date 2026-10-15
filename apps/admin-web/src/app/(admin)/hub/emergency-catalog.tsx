'use client';

import { ContentEmptyState, ContentFilters, ContentResults, ContentSection, ContentSummary, ContentToolbar } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';

import type { Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { EmergencyRow } from './emergency-row';

type EmergencyInformation = Tables<'emergency_information'>;
type CategoryFilter = 'all' | 'guidelines' | 'hotlines';

const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'guidelines', label: 'Guidelines' },
  { value: 'hotlines', label: 'Hotlines' },
];

/** Sections 3 (filter + search) and 4 (existing items) of the Emergency Hub page,
 * combined into one client component since the list they filter needs to live
 * alongside its controls to share state. */
export function EmergencyCatalog({ items }: { items: EmergencyInformation[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (category !== 'all' && item.category !== category) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, query, category]);

  const guidelines = items.filter(item => item.category === 'guidelines').length;
  const hotlines = items.filter(item => item.category === 'hotlines').length;
  const hasFilters = query.trim() !== '' || category !== 'all';
  const reset = () => { setQuery(''); setCategory('all'); };

  return <>
    <ContentSummary items={[
      { label: 'Hub entries', value: items.length, detail: 'Emergency resources for residents' },
      { label: 'Guidelines', value: guidelines, detail: 'Preparedness and safety information' },
      { label: 'Hotlines', value: hotlines, detail: 'Contact entries for urgent help' },
    ]} />
    <ContentSection title="Published entries" description="Manage the emergency information residents can rely on.">
      <ContentToolbar label="Search hub entries" query={query} onQueryChange={setQuery} placeholder="Search hub entries…">
        <ContentFilters label="Hub category" options={CATEGORY_FILTERS.map(f => ({ ...f, count: f.value === 'all' ? items.length : f.value === 'guidelines' ? guidelines : hotlines }))}
          value={category} onChange={setCategory} />
      </ContentToolbar>
      <ContentResults count={filtered.length} total={items.length} noun="entries" filtered={hasFilters} onReset={reset} />
      <div className={styles.list}>
        {filtered.map(item => <EmergencyRow key={item.id} item={item} />)}
        {filtered.length === 0 ? <ContentEmptyState title={items.length ? 'No matching entries' : 'Build your emergency hub'}
          description={items.length ? 'Try another title or clear your filters.' : 'Add a guideline or hotline so residents can find help quickly.'}
          onReset={hasFilters ? reset : undefined} /> : null}
      </div>
    </ContentSection>
  </>;
}
