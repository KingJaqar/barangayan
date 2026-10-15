import { useLocalSearchParams } from 'expo-router';
import { Body, Card, Destination, EmptyState, ResourceState, Screen } from '../../../../components/ui';
import { useApi } from '../../../../data/use-api';
import { useResource } from '../../../../data/use-resource';

export default function HelpArticle() {
  const { id } = useLocalSearchParams(); const api = useApi();
  const resource = useResource(`faq:${id}`, (signal) => api.faqArticle(id, signal));
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data === null && <EmptyState title="Help article unavailable" message="This article was removed or is not published for your barangay."><Destination title="Back to Help" href="/settings/help" /></EmptyState>}{resource.data && <Card><Body heading>{resource.data.question}</Body><Body>{resource.data.answer}</Body></Card>}</Screen>;
}
