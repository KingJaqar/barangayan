'use client';

import { ContentEmptyState, ContentFilters, ContentResults, ContentSection, ContentSummary, ContentToolbar } from '@/components/admin/content-workspace';
import styles from '@/components/admin/content-workspace.module.css';

import type { Tables } from '@barangayan/shared';
import { useMemo, useState } from 'react';

import { DocumentTypeRow } from './document-type-row';

type DocumentType = Tables<'document_types'>;
type StatusFilter = 'all' | 'active' | 'inactive';

const FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

/** Sections 3 (filter + search) and 4 (existing items) of the Services page, combined
 * into one client component since the list they filter needs to live alongside its
 * controls to share state. */
export function DocumentTypeCatalog({ documentTypes }: { documentTypes: DocumentType[] }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documentTypes.filter((doc) => {
      if (status === 'active' && !doc.is_active) return false;
      if (status === 'inactive' && doc.is_active) return false;
      if (q && !doc.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [documentTypes, query, status]);

  const active = documentTypes.filter(doc => doc.is_active).length;
  const hasFilters = query.trim() !== '' || status !== 'all';
  const reset = () => { setQuery(''); setStatus('all'); };

  return <>
    <ContentSummary items={[
      { label: 'Total services', value: documentTypes.length, detail: 'In your document catalog' },
      { label: 'Active', value: active, detail: 'Available for resident requests' },
      { label: 'Inactive', value: documentTypes.length - active, detail: 'Hidden from new requests' },
    ]} />
    <ContentSection title="Document catalog" description="Service details, requirements, and fees in one place.">
      <ContentToolbar label="Search services" query={query} onQueryChange={setQuery} placeholder="Search services…">
        <ContentFilters label="Service status" options={FILTERS.map(f => ({ ...f, count: f.value === 'all' ? documentTypes.length : f.value === 'active' ? active : documentTypes.length - active }))}
          value={status} onChange={setStatus} />
      </ContentToolbar>
      <ContentResults count={filtered.length} total={documentTypes.length} noun="services" filtered={hasFilters} onReset={reset} />
      <div className={styles.list}>
        {filtered.map(doc => <DocumentTypeRow key={doc.id} documentType={doc} />)}
        {filtered.length === 0 ? <ContentEmptyState title={documentTypes.length ? 'No matching services' : 'Your catalog starts here'}
          description={documentTypes.length ? 'Try a different name or clear your filters.' : 'Create a service to make it available for resident requests.'}
          onReset={hasFilters ? reset : undefined} /> : null}
      </div>
    </ContentSection>
  </>;
}
