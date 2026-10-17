import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Action, Body, Card, Destination, EmptyState, Notice, ResourceState, Screen, Unavailable } from '../../components/ui';
import type { DriveItem } from '../../data/resident-api';
import { releaseGates } from '../../lib/release-gates';
import { useColors, useType } from '../../lib/theme';
import { useResident } from '../../lib/runtime';
import { AvailabilityBadge, CategoryLabel, StockBar } from './drive-card';
import { AVAILABILITY_LABEL, driveAvailability, formatDriveDate, formatTimeRange, manilaToday } from './drive-model';
import { statusByDrive } from './registration-model';
import { useDrive, useRegistrationSummary } from './use-health-data';

function Fact({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  const type = useType();
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ gap: 2 }}>
    <Text style={[type.footnote, { color: colors.textSecondary }]}>{label}</Text>
    <Text selectable style={[type.body, { color: colors.textPrimary }]}>{value}</Text>
  </View>;
}

/**
 * One medical drive (A29): schedule, place, eligibility, stock, availability, and the way into self-registration. What the resident
 * may do next follows from the drive's state and their own registration, never from a guess.
 */
export function DriveDetail({ id }: { id: unknown }) {
  const resource = useDrive(id);
  const drive = resource.data;
  return <Screen>
    <ResourceState loading={resource.loading && drive === undefined} error={drive === undefined ? resource.error : undefined} retry={() => void resource.refresh()} />
    {resource.error && drive !== undefined && <Notice tone="danger" message={`These details could not be refreshed and may be out of date. ${resource.error}`} />}
    {drive === null && <EmptyState title="Drive unavailable" message="This medical drive is no longer listed. It may have ended or been removed."><Destination title="Back to Health" href="/health" /></EmptyState>}
    {drive && <DriveBody drive={drive} />}
  </Screen>;
}

function DriveBody({ drive }: { drive: DriveItem }) {
  const router = useRouter();
  const { session } = useResident();
  const summary = useRegistrationSummary();
  const today = manilaToday();
  const registration = statusByDrive(summary.data ?? []).get(drive.id) ?? null;
  const availability = driveAvailability(drive, today);
  const checking = session !== null && summary.loading && summary.data === undefined;
  return <>
    <Card>
      <CategoryLabel typeName={drive.type} />
      <Body heading>{drive.title}</Body>
      <AvailabilityBadge drive={drive} today={today} registration={registration} />
      <Fact label="Date" value={formatDriveDate(drive.drive_date)} />
      <Fact label="Time" value={formatTimeRange(drive)} />
      <Fact label="Location" value={drive.location} />
      <Fact label="Who can join" value={drive.eligible_criteria || 'No eligibility conditions were listed.'} />
      <StockBar drive={drive} />
    </Card>
    <Card>
      <Body heading role="headline">Registration</Body>
      <Body tone="secondary">Registration is for you only. Family members cannot be registered from the app.</Body>
      {!releaseGates.medicalRegistration ? <Unavailable service="Registering for a medical drive in the app" />
        : !session ? <><Body>Log in to register for this drive.</Body><Destination title="Log in or create an account" href="/auth/choice" /></>
        : registration ? <>
          <Body>{registration === 'cancelled' ? 'Your registration for this drive was cancelled. A cancelled registration cannot be re-submitted from the app; contact your barangay office to join this drive.' : 'You already have a registration for this drive.'}</Body>
          <Destination title="View my registrations" href={{ pathname: '/health', params: { segment: 'registrations' } }} />
        </> : <>
          {availability !== 'open' && <Body tone="secondary">{availability === 'closed' ? 'This drive has already taken place, so registration is closed.' : 'This drive has no slots left.'}</Body>}
          <Action label={availability === 'open' ? 'Register for this drive' : AVAILABILITY_LABEL[availability]} disabled={availability !== 'open' || checking}
            hint={availability === 'open' ? 'Opens the registration form' : undefined}
            onPress={() => router.push({ pathname: '/health/register/[id]', params: { id: drive.id } })} />
          {checking && <Body role="footnote" tone="secondary">Checking your registrations…</Body>}
        </>}
    </Card>
  </>;
}
