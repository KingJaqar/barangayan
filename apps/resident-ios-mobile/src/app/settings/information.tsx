import { Body, Card, ResourceState, Screen } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';

export default function ResidentInformation() {
  const api = useApi(); const resource = useResource('resident-information', api.information);
  const publicItems = resource.data?.filter((item) => !item.section.toLowerCase().includes('emergency'));
  return <Screen><Body heading>Resident information</Body><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{publicItems?.length === 0 && <Card><Body>No resident information is currently published by your barangay.</Body></Card>}{publicItems?.map((item) => <Card key={item.id}><Body heading>{item.title}</Body><Body>{item.body}</Body></Card>)}</Screen>;
}
