import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { getResidentTheme } from '@/constants/resident-theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

export function DrrmIconTile({ icon, color, background, compact = false }: { icon: string; color: string; background: string; compact?: boolean }) {
  const { scheme } = useThemePreference();
  // White managed glyphs need their tile's hue to remain identifiable on a soft surface.
  const tone = getResidentTheme(scheme, /^#(?:fff|ffffff)$/i.test(color) ? background : color);
  const name = isIcon(icon) ? icon : 'information-circle-outline';
  return <View style={[drrmStyles.tile, { backgroundColor: tone.accentSoft }, compact && { width: 20, height: 20, borderRadius: 0, backgroundColor: 'transparent', marginTop: 2 }]}>
    <Ionicons name={name} size={20} color={tone.accentText} accessible={false} />
  </View>;
}

function isIcon(value: string): value is keyof typeof Ionicons.glyphMap {
  return Object.prototype.hasOwnProperty.call(Ionicons.glyphMap, value);
}

export function OfflineBadge() {
  const { resident } = useTheme();
  return <View style={[drrmStyles.offline, { backgroundColor: resident.accentSoft }]}>
    <Ionicons name="wifi-outline" size={12} color={resident.accentText} accessible={false} />
    <ThemedText style={[drrmStyles.offlineText, { color: resident.accentText }]}>Offline</ThemedText>
  </View>;
}

export function DrrmSourceState({ loading = false, message, retry }: { loading?: boolean; message: string; retry?: () => void }) {
  const { resident } = useTheme();
  return <View style={[drrmStyles.state, { backgroundColor: resident.surface }]}>
    {loading ? <ActivityIndicator color={resident.accentText} accessibilityLabel="Loading emergency information" /> : null}
    <ThemedText accessibilityRole={retry ? 'alert' : undefined} style={[drrmStyles.stateText, { color: resident.muted }]}>{message}</ThemedText>
    {retry ? <PrimaryButton presentation="resident" variant="secondary" compact label="Retry" onPress={retry} /> : null}
  </View>;
}

export const drrmStyles = StyleSheet.create({
  group: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  tile: { width: 32, height: 32, borderRadius: 10, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3 },
  offlineText: { fontSize: 10.5, lineHeight: 15, fontWeight: '700' },
  state: { padding: 12, borderRadius: 12, gap: 8 },
  stateText: { fontSize: 13.5, lineHeight: 20, textAlign: 'center' },
});
