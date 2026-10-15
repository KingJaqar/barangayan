import { useLocalSearchParams } from 'expo-router';
import { Body, Card, Destination, EmptyState, ResourceState, Screen, Unavailable } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
import { releaseGates } from '../../../lib/release-gates';
export default function Drive() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const resource = useResource(`drive:${id}`, (signal) => api.drive(id, signal));
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />{resource.data === null && <EmptyState title="Drive unavailable" message="This medical drive is no longer active."><Destination title="Back to Health" href="/health" /></EmptyState>}{resource.data && <><Card><Body heading>{resource.data.title}</Body><Body>{resource.data.eligible_criteria}</Body><Body>{resource.data.location}</Body><Body>{resource.data.drive_date}</Body></Card>{releaseGates.medicalRegistration ? <Destination title="Register for this drive" href={{ pathname: '/health/register/[id]', params: { id: resource.data.id } }} /> : <Unavailable service="Medical registration" />}</>}</Screen>;
}
