import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Action, Body, Card, EmptyState, Loading, Notice, SymbolIcon } from '../../components/ui';
import { radius, space, useColors } from '../../lib/theme';
import { symbolFor, type Hotline, type HotlineNumber } from './content';
import { ContentStatus, ContentNotice } from './content-status';
import { useEmergencyContent } from './use-emergency-content';

/** Hotline directory (A22): every configured number is its own call action; the dialer asks before any call is placed. */
export function HotlinesSection() {
  const content = useEmergencyContent();
  return <>
    <Body heading>Emergency hotlines</Body>
    <ContentNotice />
    <ContentStatus resource={content.resource} retry={() => void content.resource.refresh()} />
    {!content.settled && <Loading />}
    {content.bundled.hotlines && content.settled && <Body role="footnote" tone="secondary">
      Your barangay has not published hotlines that this device could load. These national hotlines are built into the app; ask your barangay office for local numbers.
    </Body>}
    {content.settled && content.hotlines.length === 0 && <EmptyState title="No hotlines available" message="No hotline numbers are available right now." />}
    {content.hotlines.map((hotline) => <HotlineCard key={hotline.id} hotline={hotline} />)}
  </>;
}

function HotlineCard({ hotline }: { hotline: Hotline }) {
  const colors = useColors();
  return <Card>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: hotline.background ?? colors.surfaceSelected }}>
        <SymbolIcon name={symbolFor(hotline.icon, 'phone')} color={hotline.color ?? colors.primary} size={20} />
      </View>
      <View style={{ flex: 1 }}><Body role="headline">{hotline.title}</Body></View>
    </View>
    {!!hotline.note && <Body tone="secondary">{hotline.note}</Body>}
    {hotline.numbers.length === 0 && <Body tone="secondary">No phone number is published for this hotline.</Body>}
    {hotline.numbers.map((entry, index) => <CallAction key={`${entry.number}-${index}`} title={hotline.title} entry={entry} />)}
  </Card>;
}

/** One validated number. A number that is not a plain phone number is shown but never handed to the dialer. */
export function CallAction({ title, entry }: { title: string; entry: HotlineNumber }) {
  const [failed, setFailed] = useState(false);
  if (!entry.dial) return <Notice tone="danger" message={`${entry.label}: “${entry.number}” is not a valid phone number, so it cannot be called from the app.`} />;
  const dial = entry.dial;
  async function call() {
    setFailed(false);
    try { await Linking.openURL(dial); } catch { setFailed(true); }
  }
  return <View style={{ gap: space[2] }}>
    <Action label={`Call ${entry.label}: ${entry.number}`} secondary hint={`Opens the phone app for ${title}. You confirm before the call is placed.`} onPress={() => void call()} />
    {failed && <Notice tone="danger" message={`This device could not open the phone app. Dial ${entry.number} manually.`} />}
  </View>;
}
