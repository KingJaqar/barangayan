import type { ReactNode } from 'react';
import { ResourceList } from '../../components/resource-list';
import { useApi } from '../../data/use-api';
import { useDebouncedValue, usePagedResource } from '../../data/use-paged-resource';
import { useResident } from '../../lib/runtime';
import { ServiceCard } from './service-card';

/**
 * The active, non-deleted catalogue of the resident's own barangay (B06). The search term is
 * owned by the caller so it survives leaving to a detail and coming back. Realtime changes only
 * signal a re-read of the first page.
 */
export function DocumentsList({ search, header }: { search: string; header: ReactNode }) {
  const api = useApi();
  const { config } = useResident();
  const term = useDebouncedValue(search.trim());
  const resource = usePagedResource(`documents:${term}`, api.documents(term), [{ table: 'document_types', filter: `barangay_id=eq.${config.barangayId}` }]);
  return <ResourceList resource={resource} filtered={!!term} header={header}
    empty={{ title: 'No services yet', message: 'Services offered by your barangay will appear here.' }}
    noResults={{ title: 'No matching services', message: 'No service name or description matches your search. Try a different word or clear the search.' }}
    render={(row) => <ServiceCard row={row} />} />;
}
