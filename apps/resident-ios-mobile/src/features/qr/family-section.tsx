import { Body, EmptyState } from '../../components/ui';
import { useResident } from '../../lib/runtime';
import { HouseholdCard } from '../profile/household-card';
import { HouseholdQrCard } from './household-qr-card';

/**
 * The Emergency hub's Family section (A27): the resident's household QR code and the same household list the profile edits. It is not a
 * second household store: members come from, and are saved through, the shared profile card.
 */
export function FamilySection() {
  const { profile } = useResident();
  return <>
    <Body heading>Household</Body>
    <Body tone="secondary">Your household members come from your profile, and the same list is edited in Settings.</Body>
    <HouseholdQrCard />
    {profile
      ? <HouseholdCard profile={profile} />
      : <EmptyState title="Finish account setup" message="Complete your account setup to see and edit your household." />}
  </>;
}
