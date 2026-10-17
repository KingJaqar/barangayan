import { Body, ErrorState, Loading } from '../../components/ui';
import type { Freshness } from '../../data/public-cache';
import type { PublicResource } from '../../data/use-public-resource';
import { residentError } from '../../lib/errors';
import { formatRelativeTime } from '../../lib/format';

const FRESHNESS_COPY: Record<Freshness, string> = {
  fresh: 'Saved copy',
  stale: 'Saved copy — may be out of date',
  expired: 'Old saved copy — do not rely on it as current',
};

/**
 * Where the content on screen came from and how old it is, so an offline copy never reads as current
 * information. `empty` is shown by the section itself; this only reports loading, errors and age.
 */
export function ContentStatus({ resource, retry }: { resource: PublicResource<unknown>; retry: () => void }) {
  const age = resource.fetchedAt ? formatRelativeTime(new Date(resource.fetchedAt).toISOString()) : null;
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data) return resource.error ? <ErrorState message={residentError(resource.error)} retry={retry} /> : null;
  return <>
    {resource.source === 'cache' && <Body role="footnote" tone={resource.freshness === 'fresh' ? 'secondary' : 'danger'}>{`${FRESHNESS_COPY[resource.freshness ?? 'expired']} (updated ${age ?? 'at an unknown time'}).`}</Body>}
    {resource.source === 'network' && !resource.cacheFailed && <Body role="footnote" tone="secondary">Updated just now and saved for offline use.</Body>}
    {!!resource.error && <ErrorState message={`Could not refresh. ${residentError(resource.error)}`} retry={retry} />}
    {resource.cacheFailed && <Body role="footnote" tone="secondary">This information could not be saved for offline use.</Body>}
  </>;
}

/** What the app does not do: it does not monitor emergencies or guarantee alerts. */
export function ContentNotice() {
  return <Body role="footnote" tone="secondary">This app does not monitor emergencies or guarantee alerts.</Body>;
}
