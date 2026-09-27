import { useLocalSearchParams } from 'expo-router';
import { Body, Card, Destination, ResourceState, Screen, Unavailable } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
import { routeId } from '../../../data/resident-api';
import { releaseGates } from '../../../lib/release-gates';
export default function Drive() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const resource = useResource(`drive:${id}`, async (signal) => { const valid = routeId(id); return (await api.drives(signal)).find((drive) => drive.id === valid) ?? null; });
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data === null && <Body>This drive is no longer available.</Body>}{resource.data && <><Card><Body heading>{resource.data.title}</Body><Body>{resource.data.eligible_criteria}</Body><Body>{resource.data.location}</Body><Body>{resource.data.drive_date}</Body></Card>{releaseGates.medicalRegistration ? <Destination title="Register for this drive" href={{ pathname: '/health/register/[id]', params: { id: resource.data.id } }} /> : <Unavailable service="Medical registration" />}</>}</Screen>;
}
