import { Card, Destination } from '../../../../components/ui';
import { ResourceList } from '../../../../components/resource-list';
import { useApi } from '../../../../data/use-api';
import { usePagedResource } from '../../../../data/use-paged-resource';

export default function HelpIndex() {
  const api = useApi(); const resource = usePagedResource('faq', api.faq());
  return <ResourceList resource={resource} header={<Card><Destination title="Introduction to Barangayan" detail="Replay the welcome tour and appearance choices" href="/onboarding/welcome" /></Card>} empty={{ title: 'No help articles', message: 'Your barangay has not published help articles yet.' }}
    render={(article) => <Card><Destination title={article.question} detail={article.category} href={{ pathname: '/settings/help/[id]', params: { id: article.id } }} /></Card>} />;
}
