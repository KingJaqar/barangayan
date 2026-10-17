import { useMemo, useState } from 'react';
import { Image, View } from 'react-native';
import { Action, Body, Card, Sheet, SymbolIcon } from '../../components/ui';
import { releaseGates } from '../../lib/release-gates';
import { useResident } from '../../lib/runtime';
import { radius, space, useColors } from '../../lib/theme';
import { HOUSEHOLD_QR_GUIDANCE, householdQrNotice, householdQrState } from './household-qr';

function Code({ dataUri, size }: { dataUri: string; size: number }) {
  return <View accessible accessibilityRole="image" accessibilityLabel="Your household QR code" style={{ alignSelf: 'center', padding: space[3], borderRadius: radius.md, backgroundColor: '#FFFFFF' }}>
    <Image source={{ uri: dataUri }} style={{ width: size, height: size }} resizeMode="contain" />
  </View>;
}

/** "My QR code" (A27): the household code, its enlarged view and what it is for. It is a different code from an evacuation center's. */
export function HouseholdQrCard() {
  const { session, profile } = useResident();
  const colors = useColors();
  const [enlarged, setEnlarged] = useState(false);
  const accountId = session?.user.id;
  const profileId = profile?.id;
  const state = useMemo(() => householdQrState({ available: releaseGates.householdQr, accountId, profileId }), [accountId, profileId]);
  return <Card>
    <Body role="headline">My QR code</Body>
    {state.kind === 'ready'
      ? <>
        <Code dataUri={state.dataUri} size={200} />
        <Action label="Show my code" secondary onPress={() => setEnlarged(true)} hint="Shows the code larger" />
      </>
      : <View accessible accessibilityLabel={householdQrNotice(state)} style={{ alignItems: 'center', gap: space[2], padding: space[4] }}>
        <SymbolIcon name="qrcode" color={colors.textTertiary} size={48} />
        <Body tone="secondary">{householdQrNotice(state)}</Body>
      </View>}
    <Body role="footnote" tone="secondary">{HOUSEHOLD_QR_GUIDANCE}</Body>
    <Sheet visible={enlarged && state.kind === 'ready'} title="Household QR code" onClose={() => setEnlarged(false)}>
      {state.kind === 'ready' && <Code dataUri={state.dataUri} size={288} />}
      {!!profile?.full_name && <Body tone="secondary">{profile.full_name}</Body>}
      <Body role="footnote" tone="secondary">{HOUSEHOLD_QR_GUIDANCE}</Body>
    </Sheet>
  </Card>;
}
