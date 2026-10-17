import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Body, Card, EmptyState, Loading, SymbolIcon } from '../../components/ui';
import { layout, radius, space, useColors } from '../../lib/theme';
import { symbolFor, type Guideline } from './content';
import { ContentStatus, ContentNotice } from './content-status';
import { useEmergencyContent } from './use-emergency-content';

/** Preparedness guidelines (A21): expandable steps from the barangay's published content, with a labelled bundled fallback. */
export function GuidelinesSection() {
  const content = useEmergencyContent();
  const [openId, setOpenId] = useState<string | null>(null);
  return <>
    <Body heading>Disaster preparedness guidelines</Body>
    <ContentNotice />
    <ContentStatus resource={content.resource} retry={() => void content.resource.refresh()} />
    {!content.settled && <Loading />}
    {content.bundled.guidelines && content.settled && <Body role="footnote" tone="secondary">
      Your barangay has not published guidelines that this device could load. These general earthquake guidelines are built into the app.
    </Body>}
    {content.settled && content.guidelines.length === 0 && <EmptyState title="No guidelines available" message="No preparedness guidelines are available right now." />}
    {content.guidelines.length > 0 && <Card>
      {content.guidelines.map((guideline) => <GuidelineRow key={guideline.id} guideline={guideline} open={openId === guideline.id} onToggle={() => setOpenId((current) => current === guideline.id ? null : guideline.id)} />)}
    </Card>}
  </>;
}

function GuidelineRow({ guideline, open, onToggle }: { guideline: Guideline; open: boolean; onToggle: () => void }) {
  const colors = useColors();
  return <View style={{ gap: space[2] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={guideline.title} accessibilityState={{ expanded: open }} accessibilityHint={open ? 'Collapses the steps' : 'Shows the steps'} onPress={onToggle}
      style={{ minHeight: layout.listRowMin, flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
      <View style={{ width: 40, height: 40, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: guideline.background ?? colors.surfaceSelected }}>
        <SymbolIcon name={symbolFor(guideline.icon, 'info.circle')} color={guideline.color ?? colors.primary} size={20} />
      </View>
      <View style={{ flex: 1 }}><Body role="headline">{guideline.title}</Body></View>
      <SymbolIcon name={open ? 'chevron.up' : 'chevron.down'} color={colors.textTertiary} size={14} />
    </Pressable>
    {open && <View style={{ gap: space[2], paddingLeft: space[2], paddingBottom: space[3] }}>
      {!!guideline.summary && <Body>{guideline.summary}</Body>}
      {guideline.steps.map((step, index) => <View key={index} style={{ flexDirection: 'row', gap: space[2] }}>
        <Body tone="secondary">•</Body><View style={{ flex: 1 }}><Body role="callout">{step}</Body></View>
      </View>)}
      {!guideline.summary && guideline.steps.length === 0 && <Body tone="secondary">No steps were published for this guideline.</Body>}
    </View>}
  </View>;
}
