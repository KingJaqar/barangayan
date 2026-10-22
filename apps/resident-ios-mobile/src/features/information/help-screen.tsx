import { useState } from 'react';
import { ResourceList } from '../../components/resource-list';
import { Body, Card, Destination } from '../../components/ui';
import { useApi } from '../../data/use-api';
import { usePagedResource } from '../../data/use-paged-resource';
import { plainText } from '../../lib/markdown';
import { FilterChips } from '../health/filter-chips';
import { announcementPreview } from '../reports/media';
import { INFORMATION_COPY } from './copy';
import { categoryLabel, filterCategory, filterKey, HELP_FILTERS, type HelpFilter } from './help-model';

/** Help Center (A48): the seven category choices filter on the server, so paging stays right; each article opens its own screen. */
export function HelpScreen() {
  const api = useApi();
  const [filter, setFilter] = useState<HelpFilter>('all');
  const resource = usePagedResource(filterKey(filter), api.faq(filterCategory(filter)));
  const header = <>
    <FilterChips<HelpFilter> label={INFORMATION_COPY.helpFilterLabel} options={HELP_FILTERS} selected={filter} onChange={setFilter} />
    <Card>
      <Destination title={INFORMATION_COPY.helpAbout} detail={INFORMATION_COPY.helpAboutDetail} href="/settings/about" />
      <Destination title="Introduction to Barangayan" detail="Replay the welcome tour and appearance choices" href="/onboarding/welcome" />
    </Card>
  </>;
  return <ResourceList resource={resource} header={header} filtered={filter !== 'all'} empty={INFORMATION_COPY.helpEmptyAll} noResults={INFORMATION_COPY.helpEmptyCategory}
    render={(article) => <Card>
      <Destination title={article.question} detail={categoryLabel(article.category)} href={{ pathname: '/settings/help/[id]', params: { id: article.id } }} />
      <Body role="footnote" tone="secondary">{announcementPreview(plainText(article.answer), 120)}</Body>
    </Card>} />;
}
