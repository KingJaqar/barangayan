import { Markdown } from '../../components/markdown';
import { Accordion, Body, Card, EmptyState, ResourceState, Screen } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { INFORMATION_COPY } from './copy';
import { publishedLine } from './about-model';

/** Terms of Service and Privacy Policy as two separate accordions (A49), each with its publisher and publication date. */
export function TermsPrivacyScreen() {
  const api = useApi();
  const resource = useResource('policies', async (signal) => {
    const [terms, privacy, barangay] = await Promise.all([api.siteContent('terms_of_service', signal), api.siteContent('privacy_policy', signal), api.barangay(signal)]);
    return { terms, privacy, publisher: barangay.name };
  });
  const data = resource.data;
  const sections = data ? [
    { key: 'terms', fallback: INFORMATION_COPY.termsTitle, row: data.terms },
    { key: 'privacy', fallback: INFORMATION_COPY.privacyTitle, row: data.privacy },
  ] : [];
  return <Screen>
    <ResourceState loading={resource.loading && !data} error={data ? undefined : resource.error} retry={() => void resource.refresh()} />
    {resource.error && data && <Body role="footnote" tone="danger">{INFORMATION_COPY.policiesError}</Body>}
    {sections.map(({ key, fallback, row }) => <Card key={key}>
      {row ? <Accordion title={row.title.trim() || fallback} detail={publishedLine(row.updated_at, data?.publisher)}><Markdown source={row.body} /></Accordion>
        : <EmptyState title={fallback} message={INFORMATION_COPY.policyUnavailable} />}
    </Card>)}
  </Screen>;
}
