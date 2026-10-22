import { StyleSheet, View } from 'react-native';

import { DrrmSourceState, OfflineBadge, drrmStyles } from '@/components/drrm/presentation';
import { EmergencyAccordion } from '@/components/emergency-accordion';
import { HotlineRow, type HotlineNumber } from '@/components/hotline-row';
import { ThemedText } from '@/components/themed-text';
import type { useEmergencyGuidelines } from '@/hooks/use-emergency-guidelines';
import type { useEmergencyHotlines } from '@/hooks/use-emergency-hotlines';
import { useTheme } from '@/hooks/use-theme';

export function HubContent({ guidelinesSource, hotlinesSource }: {
  guidelinesSource: ReturnType<typeof useEmergencyGuidelines>;
  hotlinesSource: ReturnType<typeof useEmergencyHotlines>;
}) {
  const { resident } = useTheme();
  const { guidelines } = guidelinesSource;
  const { hotlines } = hotlinesSource;
  return <View style={styles.root}>
    <View>
      <ThemedText accessibilityRole="header" style={[styles.title, { color: resident.text }]}>Emergency Info</ThemedText>
      <ThemedText style={[styles.subtitle, { color: resident.muted }]}>Be Prepared</ThemedText>
    </View>
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <ThemedText accessibilityRole="header" style={[styles.heading, { color: resident.text }]}>Disaster Preparedness Guidelines</ThemedText>
        {guidelinesSource.isOffline ? <OfflineBadge /> : null}
      </View>
      {guidelinesSource.error ? <DrrmSourceState message={guidelines.length ? 'Unable to refresh guidelines. Showing available offline information.' : 'Unable to load guidelines.'} retry={guidelinesSource.refetch} /> : null}
      {guidelines.length ? <EmergencyAccordion items={guidelines.map(g => ({
        title: g.title, icon: g.icon, iconColor: g.icon_color, iconBg: g.icon_bg,
        content: guidelineSteps(g.content, g.body),
      }))} /> : guidelinesSource.isLoading ? <DrrmSourceState loading message="Loading guidelines…" />
        : !guidelinesSource.error ? <DrrmSourceState message="No guidelines available." /> : null}
    </View>
    <View style={styles.section}>
      <View style={styles.headingRow}>
        <ThemedText accessibilityRole="header" style={[styles.heading, { color: resident.text }]}>Emergency Hotlines</ThemedText>
        {hotlinesSource.isOffline ? <OfflineBadge /> : null}
      </View>
      {hotlinesSource.error ? <DrrmSourceState message={hotlines.length ? 'Unable to refresh hotlines. Showing available offline information.' : 'Unable to load hotlines.'} retry={hotlinesSource.refetch} /> : null}
      {hotlines.length ? <View style={[drrmStyles.group, { backgroundColor: resident.card, borderColor: resident.border }]}>
        {hotlines.map((h, index) => <View key={h.id} style={index > 0 && { borderTopWidth: 1, borderTopColor: resident.border }}>
          <HotlineRow name={h.title} numbers={hotlineNumbers(h.content)} icon={h.icon} iconColor={h.icon_color} iconBg={h.icon_bg} />
        </View>)}
      </View> : hotlinesSource.isLoading ? <DrrmSourceState loading message="Loading hotlines…" />
        : !hotlinesSource.error ? <DrrmSourceState message="No hotlines available." /> : null}
    </View>
  </View>;
}

function guidelineSteps(content: unknown, body: string): string[] {
  const steps = Array.isArray(content) ? content.filter((step): step is string => typeof step === 'string') : [];
  return steps.length ? steps : body ? [body] : [];
}

function hotlineNumbers(content: unknown): HotlineNumber[] {
  if (!Array.isArray(content)) return [];
  return content.filter((entry): entry is HotlineNumber => typeof entry === 'object' && entry !== null
    && 'label' in entry && typeof entry.label === 'string' && 'number' in entry && typeof entry.number === 'string');
}

const styles = StyleSheet.create({
  root: { gap: 18 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { marginTop: 2, fontSize: 13.5, lineHeight: 20 },
  section: { gap: 8 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heading: { flex: 1, minWidth: 0, fontSize: 16, lineHeight: 22, fontWeight: '700' },
});
