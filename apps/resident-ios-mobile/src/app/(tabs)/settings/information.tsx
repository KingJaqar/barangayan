import { Body, Card } from '../../../components/ui';
import { ResourceList } from '../../../components/resource-list';
import { useApi } from '../../../data/use-api';
import { usePagedResource } from '../../../data/use-paged-resource';

export default function ResidentInformation() {
  const api = useApi(); const resource = usePagedResource('resident-information', api.information());
  return <ResourceList resource={resource} empty={{ title: 'No resident information', message: 'Your barangay has not published resident information yet.' }}
    render={(item) => <Card><Body heading>{item.title}</Body><Body>{item.body}</Body></Card>} />;
}
