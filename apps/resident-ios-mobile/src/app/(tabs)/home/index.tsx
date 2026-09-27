import { Body, Card, Destination, ResourceState, Screen } from '../../../components/ui';
import { useApi } from '../../../data/use-api';
import { useResource } from '../../../data/use-resource';
import { useResident } from '../../../lib/runtime';
export default function Home() {
  const { profile } = useResident();
  const api = useApi();
  const barangay = useResource('barangay', api.barangay);
  return <Screen><ResourceState loading={barangay.loading} error={barangay.error} retry={() => void barangay.refresh()} />
    <Card><Body heading>{profile ? `Welcome, ${profile.first_name || profile.full_name}` : 'Welcome to Barangayan'}</Body>{barangay.data && <Body>{barangay.data.name}</Body>}<Body>Your barangay services and community updates, together.</Body>{!profile && <Destination title="Sign in or create an account" href="/auth" />}</Card>
    <Card><Destination title="Document services" href="/(tabs)/services" detail="View requirements and follow your requests." /><Destination title="Community announcements" href="/(tabs)/reports" /><Destination title="Medical drives" href="/(tabs)/health" /><Destination title="Emergency information" href="/emergency" /></Card>
    {profile && <Card><Destination title="My profile and household" href="/profile" /></Card>}
  </Screen>;
}
