import { formatCentavosAsPHP, formatProcessingTime } from '@barangayan/shared';
import { useState } from 'react';
import { Card, Destination, Field } from '../../../components/ui';
import { ResourceList } from '../../../components/resource-list';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
export default function Services() {
  const api = useApi();
  const resource = useResource('documents', api.documents);
  const [search, setSearch] = useState('');
  const filtered = resource.data?.filter((doc) => `${doc.name} ${doc.description ?? ''}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <ResourceList resource={{ ...resource, data: filtered }} empty={search ? 'No matching services. Try another search.' : 'Your barangay has no services available yet.'}
    header={<><Field label="Search services" value={search} onChangeText={setSearch} clearButtonMode="while-editing" /><Destination title="My requests and history" href="/requests" /></>}
    render={(doc) => <Card><Destination title={doc.name} detail={`${formatCentavosAsPHP(doc.fee_centavos)} · ${formatProcessingTime(doc.processing_target_hours)}`} href={{ pathname: '/services/[id]', params: { id: doc.id } }} /></Card>} />;
}
