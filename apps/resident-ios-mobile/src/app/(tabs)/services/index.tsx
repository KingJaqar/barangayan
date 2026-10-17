import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Segmented, SearchField } from '../../../components/ui';
import { DocumentsList } from '../../../features/services/documents-list';
import { OwnLogs } from '../../../features/services/own-logs';
import { OwnRequests } from '../../../features/services/own-requests';
import { ReadinessCard } from '../../../features/services/readiness-card';
import { useServiceReadiness } from '../../../features/services/readiness';
import { useResident } from '../../../lib/runtime';
import { space } from '../../../lib/theme';

type Segment = 'documents' | 'requests' | 'logs';
const SEGMENTS: readonly { value: Segment; label: string }[] = [{ value: 'documents', label: 'Documents' }, { value: 'requests', label: 'Requests' }, { value: 'logs', label: 'Logs' }];

/**
 * Documents is public. Requests and Logs are the resident's own, so the control that reaches
 * them is not rendered for a guest at all.
 */
export default function Services() {
  const { session } = useResident();
  const { segment: requested } = useLocalSearchParams<{ segment?: string }>();
  const [chosen, setChosen] = useState<Segment>(requested === 'requests' || requested === 'logs' ? requested : 'documents');
  const [search, setSearch] = useState('');
  const readiness = useServiceReadiness();
  const segment: Segment = session ? chosen : 'documents';
  const controls = <View style={{ gap: space[4] }}>
    {session && <Segmented label="Services" options={SEGMENTS} selected={segment} onChange={setChosen} />}
    <ReadinessCard readiness={readiness} />
    {segment === 'documents' && <SearchField label="Search services" hint="Search services by name or description" value={search} onChangeText={setSearch} />}
  </View>;
  if (segment === 'requests') return <OwnRequests header={controls} />;
  if (segment === 'logs') return <OwnLogs header={controls} />;
  return <DocumentsList search={search} header={controls} />;
}
