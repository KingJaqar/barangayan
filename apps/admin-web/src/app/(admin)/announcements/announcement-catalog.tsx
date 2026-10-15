'use client';

import { ContentEmptyState, ContentFilters, ContentResults, ContentSection, ContentSummary, ContentToolbar } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';

import { ANNOUNCEMENT_CATEGORIES, ANNOUNCEMENT_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { AnnouncementRow } from './announcement-row';

type Announcement = Tables<'announcements'>;
type CategoryFilter = 'all' | (typeof ANNOUNCEMENT_CATEGORIES)[number];

/** Sections 3 (filter + search) and 4 (existing items) of the Announcements page,
 * combined into one client component since the list they filter needs to live
 * alongside its controls to share state. */
export function AnnouncementCatalog({ announcements }: { announcements: Announcement[] }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return announcements.filter((a) => {
      if (category !== 'all' && a.category !== category) return false;
      if (q && !a.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [announcements, query, category]);

  const hasFilters = query.trim() !== '' || category !== 'all';
  const reset = () => { setQuery(''); setCategory('all'); };

  return <>
    <ContentSummary items={[
      { label: 'Announcements', value: announcements.length, detail: 'In your publication feed' },
      { label: 'Categories', value: new Set(announcements.map(a => a.category)).size, detail: 'Represented in your feed' },
      { label: 'Emergency', value: announcements.filter(a => a.category === 'emergency').length, detail: 'Urgent community updates' },
    ]} />
    <ContentSection title="Published announcements" description="Keep residents informed with timely community updates.">
      <ContentToolbar label="Search announcements" query={query} onQueryChange={setQuery} placeholder="Search announcements…">
        <ContentFilters<CategoryFilter> label="Announcement category" options={[
          { value: 'all', label: 'All categories', count: announcements.length },
          ...ANNOUNCEMENT_CATEGORIES.map(cat => ({ value: cat, label: ANNOUNCEMENT_CATEGORY_META[cat].label, count: announcements.filter(a => a.category === cat).length })),
        ]} value={category} onChange={setCategory} />
      </ContentToolbar>
      <ContentResults count={filtered.length} total={announcements.length} noun="announcements" filtered={hasFilters} onReset={reset} />
      <div className={styles.list}>
        {filtered.map(a => <AnnouncementRow key={a.id} announcement={a} />)}
        {filtered.length === 0 ? <ContentEmptyState title={announcements.length ? 'No matching announcements' : 'Keep your community in the loop'}
          description={announcements.length ? 'Try another title or category.' : 'Create your first announcement to share an update with residents.'}
          onReset={hasFilters ? reset : undefined} /> : null}
      </div>
    </ContentSection>
  </>;
}
