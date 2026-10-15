import { z } from 'zod';
import { Body, Card, ErrorState, Loading, Screen, Unavailable } from '../components/ui';
import { CENTER_POLICY, EMERGENCY_CONTENT_POLICY, type Freshness } from '../data/public-cache';
import { centerRow, emergencyInformationRow } from '../data/schemas';
import { useApi } from '../data/use-api';
import { usePublicResource, type PublicResource } from '../data/use-public-resource';
import { residentError } from '../lib/errors';
import { formatRelativeTime } from '../lib/format';
import { releaseGates } from '../lib/release-gates';

export default function Emergency() {
  if (!releaseGates.emergencyContent) return <Screen><Unavailable service="Emergency guidance and evacuation centers" /></Screen>;
  return <EmergencyContent />;
}

const FRESHNESS_COPY: Record<Freshness, string> = {
  fresh: 'Saved copy',
  stale: 'Saved copy — may be out of date',
  expired: 'Old saved copy — do not rely on it as current',
};

/** Source/age label so an offline copy never reads as current information. */
function SourceLabel({ resource, retry }: { resource: PublicResource<unknown>; retry: () => void }) {
  const age = resource.fetchedAt ? formatRelativeTime(new Date(resource.fetchedAt).toISOString()) : null;
  if (resource.loading && !resource.data) return <Loading />;
  if (!resource.data) return resource.error ? <ErrorState message={residentError(resource.error)} retry={retry} /> : null;
  return <>
    {resource.source === 'cache' && <Body role="footnote" tone={resource.freshness === 'fresh' ? 'secondary' : 'danger'}>{`${FRESHNESS_COPY[resource.freshness ?? 'expired']} (updated ${age ?? 'at an unknown time'}).`}</Body>}
    {!!resource.error && <ErrorState message={`Could not refresh. ${residentError(resource.error)}`} retry={retry} />}
    {resource.cacheFailed && <Body role="footnote" tone="secondary">This information could not be saved for offline use.</Body>}
  </>;
}

function EmergencyContent() {
  const api = useApi();
  const information = usePublicResource('emergency-information', api.emergencyInformation, z.array(emergencyInformationRow), EMERGENCY_CONTENT_POLICY);
  const centers = usePublicResource('evacuation-centers', api.centers, z.array(centerRow), CENTER_POLICY);
  return <Screen><Body heading>Emergency information</Body><SourceLabel resource={information} retry={() => void information.refresh()} />
    {information.data?.map((item) => <Card key={item.id}><Body heading>{item.title}</Body><Body>{item.body}</Body></Card>)}
    <Body heading>Evacuation centers</Body><SourceLabel resource={centers} retry={() => void centers.refresh()} />
    {centers.data?.map((center) => <Card key={center.id}><Body heading>{center.name}</Body><Body>{center.address ?? 'Address unavailable'}</Body><Body>{center.contact_number ?? 'Contact number unavailable'}</Body><Body>{center.current_occupancy} of {center.capacity ?? 'unknown'} reported occupants</Body></Card>)}
    <Unavailable service="Household QR and evacuation check-in" />
  </Screen>;
}
