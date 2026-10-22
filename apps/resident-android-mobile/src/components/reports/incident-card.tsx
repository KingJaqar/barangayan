import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StyleSheet, Pressable, View } from 'react-native';

import { ReadAction, ReportStatusBadge, reportStyles, useReportTone } from '@/components/reports/report-presentation';
import { ThemedText } from '@/components/themed-text';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

// Virtualized rows stay opaque; entrance animations must never hide recycled rows.
export function IncidentCard({ incident }: { incident: MyIncidentRow }) {
  const { resident } = useTheme();
  const { markIncidentRead, markIncidentUnread } = useUnreadCounts();
  const category = incident.incident_categories;
  const tone = useReportTone(category?.color ?? resident.accent);
  const firstPhoto = incident.photo_urls?.[0];
  const isResolved = incident.status === 'resolved';
  const unread = isResolved && !incident.resolved_read_at;
  return <View style={[reportStyles.row, { backgroundColor: resident.card }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={`View details for ${incident.title}${unread ? ', new update' : ''}`}
      onPress={() => router.push({ pathname: '/(app)/reports/[incidentId]', params: { incidentId: incident.id } })}
      style={({ pressed }) => [reportStyles.rowLink, pressed && { backgroundColor: resident.pressed }]}>
      {firstPhoto ? <Image source={{ uri: firstPhoto }} style={styles.thumb} contentFit="cover" /> :
        <View style={[styles.thumb, styles.placeholder, { backgroundColor: tone.soft }]}>
          <Ionicons name={(category?.icon ?? 'image-outline') as keyof typeof Ionicons.glyphMap} size={24} color={tone.ink} accessible={false} />
        </View>}
      <View style={reportStyles.content}>
        <View style={reportStyles.titleRow}>
          {unread ? <View style={[reportStyles.unread, { backgroundColor: resident.accentText }]} /> : null}
          <ThemedText style={[reportStyles.title, { color: resident.text, fontWeight: unread ? '800' : '700' }]}>{incident.title}</ThemedText>
        </View>
        {!!incident.description && <ThemedText numberOfLines={1} style={[reportStyles.summary, { color: resident.muted }]}>{incident.description}</ThemedText>}
        {category ? <ThemedText style={[styles.category, { color: tone.ink }]}>{category.name}</ThemedText> : null}
        <View style={reportStyles.meta}>
          <ReportStatusBadge status={incident.status} />
          <ThemedText style={[reportStyles.stamp, { color: resident.muted }]}>{new Date(incident.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })}</ThemedText>
          {incident.confirmation_count > 0 ? <ThemedText style={[reportStyles.stamp, { color: resident.muted }]}>{incident.confirmation_count} confirmed</ThemedText> : null}
        </View>
      </View>
    </Pressable>
    {isResolved ? <ReadAction compact label={`Mark ${incident.title} as ${unread ? 'read' : 'unread'}`} icon={unread ? 'mail-outline' : 'mail-open-outline'}
      action={() => unread ? markIncidentRead(incident.id) : markIncidentUnread(incident.id)} /> : null}
  </View>;
}
const styles = StyleSheet.create({
  thumb: { width: 64, height: 64, borderRadius: 12, flexShrink: 0 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  category: { fontSize: 12, lineHeight: 17, fontWeight: '700', marginTop: 2 },
});
