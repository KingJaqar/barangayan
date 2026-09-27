import { useState } from 'react';
import { Body, Card, Destination, Field } from '../../../components/ui';
import { ResourceList } from '../../../components/resource-list';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
export default function Health() {
  const api = useApi();
  const resource = useResource('drives', api.drives);
  const [search, setSearch] = useState('');
  return <ResourceList resource={{ ...resource, data: resource.data?.filter((drive) => `${drive.title} ${drive.type} ${drive.drive_date}`.toLowerCase().includes(search.toLowerCase())) }} header={<Field label="Search drives by title, type or date" value={search} onChangeText={setSearch} />} render={(drive) => <Card><Destination title={drive.title} href={{ pathname: '/health/[id]', params: { id: drive.id } }} /><Body>{drive.drive_date} · {drive.time_start.slice(0, 5)}–{drive.time_end.slice(0, 5)}</Body><Body>{drive.location}</Body><Body>{drive.stock_remaining} {drive.stock_unit} remaining</Body></Card>} />;
}
