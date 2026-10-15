'use client';

import { ContentEmptyState, ContentFilters, ContentResults, ContentSection, ContentSummary, ContentToolbar } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';

import { FAQ_CATEGORIES, FAQ_CATEGORY_META, type Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { FaqRow } from './faq-row';

type FaqArticle = Tables<'faq_articles'>;
type Segment = 'all' | 'published' | 'archives';

export function FaqList({ articles }: { articles: FaqArticle[] }) {
  const [segment, setSegment] = useState<Segment>('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const publishedCount = useMemo(
    () => articles.filter((a) => a.deleted_at === null && a.is_active).length,
    [articles],
  );
  const archivesCount = useMemo(
    () => articles.filter((a) => a.deleted_at !== null).length,
    [articles],
  );

  const segments: { key: Segment; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: articles.length },
    { key: 'published', label: 'Published', count: publishedCount },
    { key: 'archives', label: 'Archives', count: archivesCount },
  ];

  const filtered = useMemo(() => {
    let list = articles;

    if (segment === 'published') {
      list = list.filter((a) => a.deleted_at === null && a.is_active);
    } else if (segment === 'archives') {
      list = list.filter((a) => a.deleted_at !== null);
    }

    if (categoryFilter) {
      list = list.filter((a) => a.category === categoryFilter);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (a) =>
          a.question.toLowerCase().includes(q) ||
          a.answer.toLowerCase().includes(q),
      );
    }

    return list;
  }, [articles, segment, search, categoryFilter]);

  const hasFilters = search.trim() !== '' || categoryFilter !== null || segment !== 'all';
  const reset = () => { setSearch(''); setCategoryFilter(null); setSegment('all'); };

  return <>
    <ContentSummary items={[
      { label: 'Total articles', value: articles.length, detail: 'Across your help center' },
      { label: 'Published', value: publishedCount, detail: 'Visible to residents' },
      { label: 'Archived', value: archivesCount, detail: 'Retained for future reference' },
    ]} />
    <ContentSection title="Help center articles" description="Clear answers to your community’s common questions.">
      <div className={styles.tabs}>
        <ContentFilters label="Article visibility" value={segment} onChange={setSegment}
          options={segments.map(s => ({ value: s.key, label: s.label, count: s.count }))} />
      </div>
      <ContentToolbar label="Search FAQ articles" query={search} onQueryChange={setSearch} placeholder="Search questions and answers…" />
      <div className={styles.categoryFilters}>
        <ContentFilters<string> label="Article category" value={categoryFilter ?? 'all'}
          onChange={value => setCategoryFilter(value === 'all' ? null : value === categoryFilter ? null : value)}
          options={[{ value: 'all', label: 'All categories' }, ...FAQ_CATEGORIES.map(cat => ({ value: cat, label: FAQ_CATEGORY_META[cat].label }))]} />
      </div>
      <ContentResults count={filtered.length} total={articles.length} noun="articles" filtered={hasFilters} onReset={reset} />
      <div className={styles.list}>
        {filtered.map(a => <FaqRow key={a.id} article={a} />)}
        {filtered.length === 0 ? <ContentEmptyState title={articles.length ? 'No matching articles' : 'A helpful answer starts here'}
          description={articles.length ? 'Try another question, category, or visibility filter.' : 'Create your first FAQ article to help residents find answers.'}
          onReset={hasFilters ? reset : undefined} /> : null}
      </div>
    </ContentSection>
  </>;
}
