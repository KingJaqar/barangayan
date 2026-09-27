import { Body, Card, ResourceState, Screen, Unavailable } from '../components/ui';
import { useApi } from '../data/use-api';
import { useResource } from '../data/use-resource';
import { releaseGates } from '../lib/release-gates';

export default function Emergency() {
  if (!releaseGates.emergencyContent) return <Screen><Unavailable service="Emergency guidance and evacuation centers" /></Screen>;
  return <EmergencyContent />;
}

function EmergencyContent() {
  const api = useApi();
  const information = useResource('emergency-information', api.information);
  const centers = useResource('evacuation-centers', api.centers);
  return <Screen><Body heading>Emergency information</Body><ResourceState loading={information.loading || centers.loading} error={information.error ?? centers.error} retry={() => { void information.refresh(); void centers.refresh(); }} />
    {information.data?.map((item) => <Card key={item.id}><Body heading>{item.title}</Body><Body>{item.body}</Body></Card>)}
    <Body heading>Evacuation centers</Body>{centers.data?.map((center) => <Card key={center.id}><Body heading>{center.name}</Body><Body>{center.address ?? 'Address unavailable'}</Body><Body>{center.contact_number ?? 'Contact number unavailable'}</Body><Body>{center.current_occupancy} of {center.capacity ?? 'unknown'} reported occupants</Body></Card>)}
    <Unavailable service="Household QR and evacuation check-in" />
  </Screen>;
}
