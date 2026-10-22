import { useLocalSearchParams } from 'expo-router';
import { Markdown } from '../../components/markdown';
import { Body, Card, Destination, EmptyState, ResourceState, Screen, StatusBadge } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { INFORMATION_COPY } from './copy';
import { categoryLabel } from './help-model';

/** One help article with its rich text. A removed or unpublished article is a clear not-found state, not an empty screen. */
export function HelpArticle() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const api = useApi();
  const resource = useResource(`faq:${id}`, (signal) => api.faqArticle(id, signal));
  const article = resource.data;
  return <Screen>
    <ResourceState loading={resource.loading && !article} error={article ? undefined : resource.error} retry={() => void resource.refresh()} />
    {resource.error && article && <Body role="footnote" tone="danger">{INFORMATION_COPY.helpArticleError}</Body>}
    {article === null && <EmptyState title={INFORMATION_COPY.helpMissing.title} message={INFORMATION_COPY.helpMissing.message}><Destination title={INFORMATION_COPY.helpBack} href="/settings/help" /></EmptyState>}
    {article && <Card>
      <StatusBadge label={categoryLabel(article.category)} icon="info.circle" tone="neutral" />
      <Body heading>{article.question}</Body>
      <Markdown source={article.answer} />
    </Card>}
    {article && <Card><Destination title={INFORMATION_COPY.helpAbout} detail={INFORMATION_COPY.helpAboutDetail} href="/settings/about" /></Card>}
  </Screen>;
}
