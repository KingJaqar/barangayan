import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { incidentStatusMeta } from '@/constants/incident-status';
import { getResidentTheme } from '@/constants/resident-theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

/** Preserve admin colors with readable ink on the account's selected surfaces. */
export function useReportTone(color: string) {
  const { scheme } = useThemePreference();
  const tone = useMemo(() => getResidentTheme(scheme, color), [scheme, color]);
  return { ink: tone.accentText, soft: tone.accentSoft };
}

export function reportTimeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 60) return minutes <= 1 ? 'Just now' : `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

export function ReportStatusBadge({ status }: { status: string }) {
  const meta = incidentStatusMeta(status);
  const tone = useReportTone(meta.fg);
  return <View style={[reportStyles.status, { backgroundColor: tone.soft }]}>
    <Ionicons name={meta.icon as keyof typeof Ionicons.glyphMap} size={12} color={tone.ink} accessible={false} />
    <ThemedText style={[reportStyles.statusLabel, { color: tone.ink }]}>{meta.label}</ThemedText>
  </View>;
}

/** Read controls are siblings of row links; one press dispatches one action. */
export function ReadAction({ label, action, disabled = false, icon = 'checkmark-done-outline', compact = false, inline = false }: {
  label: string; action: () => Promise<void>; disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap; compact?: boolean; inline?: boolean;
}) {
  const { resident } = useTheme();
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return <View style={compact ? reportStyles.readColumn : undefined}>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy} onPress={async () => {
        if (locked.current) return;
        locked.current = true; setBusy(true); setError(false);
        try { await action(); } catch { setError(true); }
        finally { locked.current = false; setBusy(false); }
      }} style={({ pressed }) => [reportStyles.readAction, compact && reportStyles.readIcon, inline && reportStyles.readInline,
        pressed && { backgroundColor: resident.pressed }]}>
      {busy ? <ActivityIndicator size="small" color={resident.accentText} /> : <Ionicons name={icon} size={compact ? 18 : inline ? 14 : 16} color={disabled ? resident.muted : resident.accentText} accessible={false} />}
      {!compact ? <ThemedText numberOfLines={inline ? 1 : undefined} style={[reportStyles.readLabel, inline && reportStyles.readInlineLabel, { color: disabled ? resident.muted : resident.accentText }]}>{label}</ThemedText> : null}
    </Pressable>
    {error ? <ThemedText accessibilityRole="alert" style={[reportStyles.readError, { color: resident.danger }]}>Could not update read status. Try again.</ThemedText> : null}
  </View>;
}

export function ReportSourceState({ message, retry, retryLabel = 'Retry loading' }: { message: string; retry?: () => void; retryLabel?: string }) {
  const { resident } = useTheme();
  return <View style={[reportStyles.state, { backgroundColor: resident.surface }]}>
    <ThemedText accessibilityRole={retry ? 'alert' : undefined} style={{ color: resident.muted, textAlign: 'center' }}>{message}</ThemedText>
    {retry ? <Pressable accessibilityRole="button" accessibilityLabel={retryLabel} onPress={retry} style={reportStyles.readAction}>
      <ThemedText style={{ color: resident.accentText }}>Try again</ThemedText>
    </Pressable> : null}
  </View>;
}

export const reportStyles = StyleSheet.create({
  heading: { fontSize: 21, lineHeight: 26, fontWeight: '800', letterSpacing: -0.4 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowLink: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'flex-start', gap: 14, paddingLeft: 16, paddingRight: 8, paddingVertical: 14 },
  content: { flex: 1, minWidth: 0, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  unread: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  summary: { fontSize: 13, lineHeight: 19 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginTop: 3 },
  stamp: { fontSize: 12, lineHeight: 17 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' },
  statusLabel: { fontSize: 11.5, lineHeight: 16, fontWeight: '700' },
  readColumn: { width: 48, justifyContent: 'center' },
  readAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, borderRadius: 100, paddingHorizontal: 12 },
  readIcon: { width: 48, paddingHorizontal: 0 },
  readInline: { flexWrap: 'nowrap', paddingHorizontal: 0, gap: 4 },
  readInlineLabel: { fontSize: 12, lineHeight: 18, includeFontPadding: false, textAlignVertical: 'center' },
  readLabel: { fontSize: 13.5, lineHeight: 19, fontWeight: '700' },
  readError: { fontSize: 12, lineHeight: 17, padding: 4 },
  state: { margin: 20, padding: 16, borderRadius: 16, alignItems: 'center', gap: 8 },
});
