import { idVerificationMessages } from '@barangayan/shared';
import { useRouter } from 'expo-router';
import { Action, Body, Card, Loading, StatusBadge } from '../../components/ui';
import type { IdReadiness } from './catalog';
import type { useServiceReadiness } from './readiness';

export const ID_COPY: Record<Exclude<IdReadiness, 'verified'>, string> = {
  ...idVerificationMessages,
  unknown: 'We could not confirm your ID status. It is not treated as approved until it is confirmed.',
};

/** Profile and ID readiness shown above the catalogue (A09-018…020). Verified residents see a single badge. */
export function ReadinessCard({ readiness }: { readiness: ReturnType<typeof useServiceReadiness> }) {
  const router = useRouter();
  if (!readiness.signedIn) return null;
  if (!readiness.profileComplete) {
    return <Card><Body heading role="headline">Complete your profile</Body><Body tone="secondary">Requests need your name, address and contact details.</Body>
      <Action label="Complete your profile" onPress={() => router.push({ pathname: '/complete-profile', params: { next: '/services' } })} /></Card>;
  }
  if (readiness.checking && readiness.idStatus === 'unknown') return <Loading label="Checking ID verification…" />;
  if (readiness.idStatus === 'verified') return <StatusBadge label="Valid ID verified" icon="checkmark.shield" tone="success" />;
  return <Card><Body heading role="headline">ID verification</Body>
    <Body tone={readiness.error ? 'danger' : 'secondary'}>{readiness.error ?? ID_COPY[readiness.idStatus]}</Body>
    <Action label="Verify now" onPress={() => router.push('/settings/id-verification')} />
    {readiness.idStatus === 'unknown' && <Action label="Retry verification check" secondary disabled={readiness.checking} onPress={() => void readiness.retry()} />}
  </Card>;
}
