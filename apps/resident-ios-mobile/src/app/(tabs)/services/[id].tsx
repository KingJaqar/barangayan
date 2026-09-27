import { formatCentavosAsPHP, formatProcessingTime } from '@barangayan/shared';
import { useLocalSearchParams } from 'expo-router';
import { Body, Card, Destination, ResourceState, Screen } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
import { useResident } from '../../../lib/runtime';
export default function DocumentDetail() {
  const { id } = useLocalSearchParams();
  const api = useApi();
  const { session } = useResident();
  const resource = useResource(`document:${id}`, (signal) => api.document(id, signal));
  const doc = resource.data;
  return <Screen><ResourceState loading={resource.loading} error={resource.error} retry={() => void resource.refresh()} />
    {doc === null && <Body>This service is no longer available.</Body>}
    {doc && <><Card><Body heading>{doc.name}</Body><Body>{formatCentavosAsPHP(doc.fee_centavos)}</Body><Body>{doc.description}</Body><Body>{formatProcessingTime(doc.processing_target_hours)}</Body></Card><Card><Body heading>Requirements</Body>{doc.requirements.map((requirement, index) => <Body key={index}>{requirement}</Body>)}<Body>Bring original documents for verification at the barangay hall. Processing times are estimates.</Body></Card>
      {session ? <Destination title="Request this document" href={{ pathname: '/services/request/[id]', params: { id: doc.id } }} /> : <Destination title="Sign in to request documents" href="/auth" />}</>}
  </Screen>;
}
