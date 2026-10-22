import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DrrmDisclosure } from '@/components/drrm/disclosure';
import { DrrmIconTile, drrmStyles } from '@/components/drrm/presentation';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export interface AccordionItem {
  title: string;
  icon: string;
  iconColor: string;
  iconBg: string;
  content: string[];
}

export function EmergencyAccordion({ items }: { items: AccordionItem[] }) {
  const { resident } = useTheme();
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return <View style={[drrmStyles.group, { backgroundColor: resident.card, borderColor: resident.border }]}>
    {items.map((item, index) => <View key={index}
      style={index > 0 && { borderTopWidth: 1, borderTopColor: resident.border }}>
      <DrrmDisclosure open={openIndex === index} onToggle={() => setOpenIndex(previous => previous === index ? null : index)}
        label={`${item.title} guidelines`} headerStyle={styles.header}
        header={<><DrrmIconTile icon={item.icon} color={item.iconColor} background={item.iconBg} />
          <ThemedText style={[styles.title, { color: resident.text }]}>{item.title}</ThemedText></>}>
        <View style={styles.steps}>
          {item.content.map((step, stepIndex) => <View key={stepIndex} style={styles.step}>
            <View style={[styles.bullet, { backgroundColor: resident.muted }]} />
            <ThemedText style={[styles.text, { color: resident.text }]}>{step}</ThemedText>
          </View>)}
        </View>
      </DrrmDisclosure>
    </View>)}
  </View>;
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 12, paddingVertical: 10 },
  title: { flex: 1, minWidth: 0, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  steps: { paddingLeft: 58, paddingRight: 12, paddingBottom: 12, gap: 8 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  text: { flex: 1, fontSize: 13.5, lineHeight: 20 },
});
