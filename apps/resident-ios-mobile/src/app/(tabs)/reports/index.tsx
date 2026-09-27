import { Card, Destination } from '../../../components/ui';
import { ResourceList } from '../../../components/resource-list';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
export default function Reports() {
  const api = useApi();
  const resource = useResource('announcements', api.announcements);
  return <ResourceList resource={resource} empty="No announcements have been published yet." render={(item) => <Card><Destination title={item.title} detail={`${item.category} · ${new Date(item.published_at).toLocaleDateString()}`} href={{ pathname: '/reports/[id]', params: { id: item.id } }} /></Card>} />;
}
