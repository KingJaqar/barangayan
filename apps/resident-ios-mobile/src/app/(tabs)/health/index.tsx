import { useState } from 'react';
import { Body, Card, Destination, Field } from '../../../components/ui';
import { ResourceList } from '../../../components/resource-list';
import { useApi } from '../../../data/use-api';
import { useDebouncedValue, usePagedResource } from '../../../data/use-paged-resource';
import { useResident } from '../../../lib/runtime';
export default function Health() {
  const api = useApi();
  const { config } = useResident();
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search.trim());
  const resource = usePagedResource(`drives:${term}`, api.drives(term), [{ table: 'medical_drives', filter: `barangay_id=eq.${config.barangayId}` }]);
  return <ResourceList resource={resource} filtered={!!term} empty={{ title: 'No medical drives', message: 'Your barangay has no active medical drives right now.' }} noResults={{ title: 'No matching drives', message: 'Try another title, type, location or date (YYYY-MM-DD).' }} header={<Field label="Search drives by title, type, location or date" value={search} onChangeText={setSearch} clearButtonMode="while-editing" />} render={(drive) => <Card><Destination title={drive.title} href={{ pathname: '/health/[id]', params: { id: drive.id } }} /><Body>{drive.drive_date} · {drive.time_start.slice(0, 5)}–{drive.time_end.slice(0, 5)}</Body><Body>{drive.location}</Body><Body>{drive.stock_remaining} {drive.stock_unit} remaining</Body></Card>} />;
}
