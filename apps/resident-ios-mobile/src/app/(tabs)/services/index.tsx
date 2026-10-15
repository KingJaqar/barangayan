import { formatCentavosAsPHP, formatProcessingTime } from '@barangayan/shared';
import { useState } from 'react';
import { Card, Destination, Field } from '../../../components/ui';
import { ResourceList } from '../../../components/resource-list';
import { useApi } from '../../../data/use-api';
import { useDebouncedValue, usePagedResource } from '../../../data/use-paged-resource';
import { useResident } from '../../../lib/runtime';
export default function Services() {
  const api = useApi();
  const { config } = useResident();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim());
  const resource = usePagedResource(`documents:${term}`, api.documents(term), [{ table: 'document_types', filter: `barangay_id=eq.${config.barangayId}` }]);
  return <ResourceList resource={resource} filtered={!!term} empty={{ title: 'No services yet', message: 'Your barangay has no services available yet.' }} noResults={{ title: 'No matching services', message: 'Try another search term.' }}
    header={<><Field label="Search services" value={search} onChangeText={setSearch} clearButtonMode="while-editing" /><Destination title="My requests and history" href="/requests" /></>}
    render={(doc) => <Card><Destination title={doc.name} detail={`${formatCentavosAsPHP(doc.fee_centavos)} · ${formatProcessingTime(doc.processing_target_hours)}`} href={{ pathname: '/services/[id]', params: { id: doc.id } }} /></Card>} />;
}
