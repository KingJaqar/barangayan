import { Body, Card, Destination, ResourceState, Screen } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';

export default function HelpIndex() {
  const api = useApi(); const resource = useResource('faq', api.faq);
  return <Screen><Body heading>Help and frequently asked questions</Body><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data?.length === 0 && <Card><Body>No help articles are currently published by your barangay.</Body></Card>}{resource.data?.map((article) => <Card key={article.id}><Destination title={article.question} detail={article.category} href={{ pathname: '/settings/help/[id]', params: { id: article.id } }} /></Card>)}</Screen>;
}
