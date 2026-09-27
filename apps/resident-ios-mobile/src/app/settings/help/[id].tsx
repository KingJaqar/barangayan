import { useLocalSearchParams } from 'expo-router';
import { Body, Card, ResourceState, Screen } from '../../../components/ui';
import { routeId } from '../../../data/resident-api';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';

export default function HelpArticle() {
  const { id } = useLocalSearchParams(); const api = useApi();
  const resource = useResource(`faq:${id}`, async (signal) => { const valid = routeId(id); return (await api.faq(signal)).find((row) => row.id === valid) ?? null; });
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data === null && <Body>This help article is unavailable.</Body>}{resource.data && <Card><Body heading>{resource.data.question}</Body><Body>{resource.data.answer}</Body></Card>}</Screen>;
}
