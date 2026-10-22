import { catalogContract, type Tables } from '@barangayan/shared';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { DocumentAccordion } from '@/components/services/document-accordion';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

function Heading({ title, icon }: { title: string; icon?: keyof typeof Ionicons.glyphMap }) {
  const { resident } = useTheme();
  return <View style={styles.heading}>
    {icon ? <Ionicons name={icon} size={18} color={resident.muted} accessible={false} /> : null}
    <ThemedText accessibilityRole="header" style={icon ? styles.subheading : styles.sectionTitle}>{title}</ThemedText>
  </View>;
}

/** Only stored numbering is promoted into a marker; unnumbered charter prose stays prose. */
function CharterText({ value, connected = false, correctPersonalAppearanceNumber = false }: { value: string; connected?: boolean; correctPersonalAppearanceNumber?: boolean }) {
  const { resident } = useTheme();
  const lines = value.split('\n').map(line => line.trim()).filter(Boolean);
  return <View>{lines.map((line, index) => {
    const match = line.match(/^(\d+(?:\.\d+)*[.)])\s+(.*)$/);
    if (!match) return <ThemedText key={index} style={styles.prose}>{line}</ThemedText>;
    return <View key={index} style={[styles.numbered, { paddingBottom: index === lines.length - 1 ? 0 : connected ? 16 : 10 }]}>
      {connected && index < lines.length - 1 ? <View style={[styles.connector, { backgroundColor: resident.accentSoft }]} /> : null}
      <View style={[styles.number, { backgroundColor: connected ? resident.accent : resident.surface }]}>
        <ThemedText type="smallBold" style={[styles.numberText, { color: connected ? resident.onAccent : resident.text }]}>{correctPersonalAppearanceNumber && /^3[.)]$/.test(match[1]) && /^PERSONAL APPEARANCE$/i.test(match[2].trim()) ? match[1].replace('3', '2') : match[1]}</ThemedText>
      </View>
      <ThemedText style={[styles.prose, { flex: 1, paddingTop: 3 }]}>{match[2]}</ThemedText>
    </View>;
  })}</View>;
}

export function DocumentGuideContent({ doc }: { doc: Tables<'document_types'> }) {
  const { resident } = useTheme();
  const catalog = catalogContract(doc);
  const divider = { borderTopWidth: 1, borderTopColor: resident.border };
  const fact = (title: string, value: string, icon: keyof typeof Ionicons.glyphMap) => <View style={styles.fact}>
    <View style={styles.heading}><Ionicons name={icon} size={14} color={resident.muted} accessible={false} /><ThemedText style={styles.factLabel}>{title}</ThemedText></View>
    <ThemedText type="smallBold" style={styles.factValue}>{value}</ThemedText>
  </View>;
  return <>
    {catalog ? <Card variant="resident">
      {fact('Office/Division', catalog.charter.officeDivision, 'business-outline')}
      <View style={[styles.factRow, divider]}>
        <View style={{ flex: 1 }}>{fact('Classification', catalog.charter.classification, 'layers-outline')}</View>
        <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: resident.border }}>{fact('Type of Transaction', catalog.charter.transactionType, 'swap-horizontal-outline')}</View>
      </View>
      <View style={divider}>{fact('Who May Avail', catalog.charter.whoMayAvail, 'people-outline')}</View>
    </Card> : null}
    {catalog ? <View style={styles.section}>
      <Heading title="Requirements" />
      {catalog ? <Card variant="resident">
        <View style={styles.panelBody}><Heading title="Checklist of Requirements" icon="checkbox-outline" /><CharterText value={catalog.charter.checklistOfRequirements} correctPersonalAppearanceNumber={doc.name === 'Reproduction or Photocopy of Barangay Records, Data, and Similar Documents (Certified True Copy)'} /></View>
        <View style={[styles.panelBody, divider]}><Heading title="Where to Secure the Requirements" icon="location-outline" /><CharterText value={catalog.charter.whereToSecureRequirements} /></View>
      </Card> : null}
    </View> : null}
    {!catalog && doc.requirements.length > 0 ? <View style={styles.section}>
      <Heading title="Requirements" />
      <Card variant="resident" style={styles.panelBody}>
        {doc.requirements.map((requirement, index) => <View key={index} style={styles.heading}>
          <Ionicons name="checkmark-circle-outline" size={20} color={resident.accentText} accessible={false} />
          <ThemedText style={[styles.prose, { flex: 1 }]}>{requirement}</ThemedText>
        </View>)}
      </Card>
    </View> : null}
    {catalog ? <>
      <View style={styles.section}><Heading title="Client Steps" /><Card variant="resident" style={styles.panelBody}><CharterText value={catalog.charter.clientSteps} connected /></Card></View>
      <Card variant="resident">
        <View style={styles.panelBody}><Heading title="Fees to Be Paid" icon="cash-outline" /><CharterText value={catalog.charter.feesToBePaid} /></View>
        <View style={[styles.panelBody, divider]}><Heading title="Processing Time" icon="time-outline" /><CharterText value={catalog.charter.processingTime} /></View>
      </Card>
    </> : null}
    <Card variant="resident">
      {catalog ? <>
        <DocumentAccordion title="Agency Actions" icon="briefcase-outline"><CharterText value={catalog.charter.agencyActions} /></DocumentAccordion>
        <View style={divider}><DocumentAccordion title="Person Responsible" icon="person-outline"><CharterText value={catalog.charter.personResponsible ?? 'Not specified in the source charter'} /></DocumentAccordion></View>
      </> : null}
      <View style={catalog ? divider : undefined}><DocumentAccordion title="Additional Notes" icon="information-circle-outline">
        <ThemedText style={[styles.notes, { backgroundColor: resident.surface, color: resident.muted }]}>Please ensure all requirements are complete before proceeding. Bring the original documents for verification at the Barangay Hall. Processing times are estimates and may vary during peak periods.</ThemedText>
      </DocumentAccordion></View>
    </Card>
  </>;
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  section: { gap: 12 },
  sectionTitle: { fontSize: 17, lineHeight: 23, fontWeight: '700' },
  subheading: { flex: 1, fontSize: 14.5, lineHeight: 20, fontWeight: '700' },
  fact: { paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  factRow: { flexDirection: 'row' },
  factLabel: { flexShrink: 1, fontSize: 12, lineHeight: 18, fontWeight: '600' },
  factValue: { fontSize: 14.5, lineHeight: 20 },
  panelBody: { padding: 16, gap: 12 },
  prose: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  numbered: { flexDirection: 'row', gap: 12 },
  connector: { position: 'absolute', top: 28, bottom: 0, left: 13, width: 2 },
  number: { minWidth: 28, minHeight: 28, paddingHorizontal: 4, borderRadius: 14, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  numberText: { fontSize: 12.5, lineHeight: 18 },
  notes: { padding: 14, borderRadius: 12, fontSize: 13.5, lineHeight: 20 },
});
