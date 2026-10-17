import type { IconName } from '@expo/ui';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Text, View } from 'react-native';
import { useAuthFlow } from '../../auth/auth-flow';
import { Action, Body, Card, Destination, EmptyState, ResourceState, Screen, SymbolIcon } from '../../components/ui';
import { subscribeToChanges } from '../../data/realtime';
import { uuid } from '../../data/resident-api';
import { useApi } from '../../data/use-api';
import { useResource } from '../../data/use-resource';
import { useResident } from '../../lib/runtime';
import { radius, space, useColors, useType } from '../../lib/theme';
import { applyState, describeService, extraRequirements, NOT_SPECIFIED, SERVICE_COPY, serviceIcon, type ApplyState, type CatalogueRow, type CharterKey } from './catalog';
import { useServiceReadiness } from './readiness';
import { ID_COPY } from './readiness-card';

const CHARTER_ICON: Record<CharterKey, IconName> = {
  officeDivision: 'building.2',
  classification: 'square.stack.3d.up',
  transactionType: 'arrow.left.arrow.right',
  whoMayAvail: 'person.2',
  checklistOfRequirements: 'checklist',
  whereToSecureRequirements: 'mappin.and.ellipse',
  clientSteps: 'figure.walk',
  agencyActions: 'briefcase',
  feesToBePaid: 'banknote',
  processingTime: 'clock',
  personResponsible: 'person',
};

/** Service detail (A10): configured content only, with the request action matched to what the resident still needs. */
export function DocumentDetail({ id }: { id: string | string[] | undefined }) {
  const api = useApi();
  const { client } = useResident();
  const resource = useResource(`document:${id}`, (signal) => api.document(id, signal));
  const row = resource.data;
  const parsed = uuid.safeParse(id);
  const watched = parsed.success ? parsed.data : null;
  const refresh = useRef(resource.refresh);
  useEffect(() => { refresh.current = resource.refresh; });
  // A change to this catalogue row (edit, deactivation, deletion) re-reads it; the read decides what is shown.
  useEffect(() => {
    if (!watched) return;
    return subscribeToChanges(client, 'document-detail', [{ table: 'document_types', filter: `id=eq.${watched}` }], () => void refresh.current());
  }, [client, watched]);

  return <Screen>
    <ResourceState loading={resource.loading && !row} error={resource.error} retry={() => void resource.refresh()} skeleton />
    {row === null && !resource.error && <EmptyState title="Service unavailable" message="This service is no longer offered by your barangay, or the link is not valid."><Destination title="Back to Services" href="/services" /></EmptyState>}
    {row && watched && <Content row={row} id={watched} />}
  </Screen>;
}

function Content({ row, id }: { row: CatalogueRow; id: string }) {
  const colors = useColors();
  const type = useType();
  const entry = describeService(row);
  const readiness = useServiceReadiness();
  const apply = applyState({ entry, signedIn: readiness.signedIn, profileComplete: readiness.profileComplete, idStatus: readiness.idStatus });
  const requirements = entry.contract === 'charter' ? extraRequirements(entry) : entry.requirements;
  return <>
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ width: 52, height: 52, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSelected }}>
          <SymbolIcon name={serviceIcon(row)} color={colors.primary} size={26} />
        </View>
        <View style={{ flex: 1 }}><Body heading role="title1">{row.name}</Body></View>
      </View>
      {!!row.description && <Body tone="secondary">{row.description}</Body>}
      <MetaRow icon="banknote" label="Fee" value={entry.priceLabel} />
      <MetaRow icon="clock" label="Processing" value={entry.processingLabel} />
    </Card>
    <ApplyBlock apply={apply} id={id} readiness={readiness} />
    {entry.charter.map((section) => <Card key={section.key}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        <SymbolIcon name={CHARTER_ICON[section.key]} color={colors.primary} size={18} />
        <View style={{ flex: 1 }}><Body heading role="headline">{section.label}</Body></View>
      </View>
      {section.lines.length ? section.lines.map((line, index) => <Body key={`${index}-${line}`}>{line}</Body>) : <Body tone="secondary">{NOT_SPECIFIED}</Body>}
    </Card>)}
    {entry.purposes.length > 0 && <Card>
      <Body heading role="headline">Purposes you can choose</Body>
      {entry.purposes.map((purpose) => <Body key={purpose.code}>{purpose.requiresExplanation ? `${purpose.label} (an explanation is required)` : purpose.label}</Body>)}
    </Card>}
    {entry.rules.length > 0 && <Card><Body heading role="headline">Additional conditions</Body>{entry.rules.map((rule) => <Body key={rule}>{rule}</Body>)}</Card>}
    {entry.contract !== 'unsupported' && (requirements.length > 0 || entry.contract === 'legacy') && <Card>
      <Body heading role="headline">Requirements</Body>
      {requirements.length > 0 ? requirements.map((requirement, index) => <Body key={`${index}-${requirement}`}>{`• ${requirement}`}</Body>) : <Body tone="secondary">{NOT_SPECIFIED}</Body>}
    </Card>}
    <Card><Body heading role="headline">Before you go</Body><Text style={[type.subheadline, { color: colors.textSecondary }]}>{SERVICE_COPY.originalsNote}</Text></Card>
  </>;
}

function MetaRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const colors = useColors();
  const type = useType();
  return <View accessible accessibilityLabel={`${label}: ${value}`} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
    <View style={{ paddingTop: 2 }}><SymbolIcon name={icon} color={colors.primary} size={16} /></View>
    <Text style={[type.callout, { color: colors.textPrimary, flex: 1 }]}><Text style={{ color: colors.textSecondary }}>{`${label}: `}</Text>{value}</Text>
  </View>;
}

export function ApplyBlock({ apply, id, readiness }: { apply: ApplyState; id: string; readiness: ReturnType<typeof useServiceReadiness> }) {
  const router = useRouter();
  const { rememberDestination } = useAuthFlow();
  switch (apply.kind) {
    case 'unavailable':
      return <Card><Body heading role="headline">Not available to request yet</Body><Body tone="secondary">{apply.reason}</Body></Card>;
    case 'guest':
      return <Card>
        <Body tone="secondary">Public information stays available without an account. Log in to request this document.</Body>
        <Action label="Log in to request" onPress={() => { rememberDestination(`/services/${id}`); router.push('/auth/choice'); }} />
      </Card>;
    case 'profile-incomplete':
      return <Card>
        <Body heading role="headline">Complete your profile first</Body>
        <Body tone="secondary">Requests need your name, address and contact details.</Body>
        <Action label="Complete your profile" onPress={() => router.push({ pathname: '/complete-profile', params: { next: `/services/${id}` } })} />
      </Card>;
    case 'id':
      return <Card>
        <Body heading role="headline">{apply.status === 'unknown' ? 'ID status unavailable' : 'Verify your ID to request'}</Body>
        <Body tone={readiness.error ? 'danger' : 'secondary'}>{readiness.error ?? ID_COPY[apply.status]}</Body>
        {apply.status === 'unknown'
          ? <Action label="Retry verification check" disabled={readiness.checking} onPress={() => void readiness.retry()} />
          : <Action label="Verify now" onPress={() => router.push('/settings/id-verification')} />}
      </Card>;
    case 'ready':
      return <Action label="Request this document" onPress={() => router.push({ pathname: '/services/request/[id]', params: { id } })} />;
  }
}
