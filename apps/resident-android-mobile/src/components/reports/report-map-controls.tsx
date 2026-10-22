import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

export function ReportMapControls({ onZoomIn, onZoomOut, onRecenter, onFit, onLocate, locating = false }: {
  onZoomIn: () => void; onZoomOut: () => void; onRecenter?: () => void;
  onFit?: () => void; onLocate?: () => void; locating?: boolean;
}) {
  const { resident } = useTheme();
  const vertical = !onFit;
  const surface = { backgroundColor: resident.card, borderColor: resident.border };
  return <View pointerEvents="box-none" style={vertical ? styles.column : styles.row}>
    {onFit ? <View style={[styles.pill, surface]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Show barangay boundary" onPress={onFit} style={styles.labeled}>
        <Ionicons name="map-outline" size={18} color={resident.accentText} /><ThemedText style={[styles.label, { color: resident.accentText }]}>Maps</ThemedText>
      </Pressable>
      <View style={[styles.divider, { backgroundColor: resident.border }]} />
      <Pressable accessibilityRole="button" accessibilityLabel="Use my current location" accessibilityState={{ busy: locating, disabled: locating }} disabled={locating} onPress={onLocate} style={styles.labeled}>
        {locating ? <ActivityIndicator size="small" color={resident.accentText} /> : <Ionicons name="navigate-outline" size={18} color={resident.accentText} />}
        <ThemedText style={[styles.label, { color: resident.accentText }]}>You</ThemedText>
      </Pressable>
    </View> : null}
    <View style={[styles.pill, surface, vertical && { flexDirection: 'column' }]}>
      {(vertical ? ['in', 'out'] as const : ['out', 'in'] as const).map((direction, index) => <View key={direction}>
        {index ? <View style={vertical ? { height: 1, backgroundColor: resident.border } : undefined} /> : null}
        <Pressable accessibilityRole="button" accessibilityLabel={'Zoom ' + direction} onPress={direction === 'in' ? onZoomIn : onZoomOut} style={styles.button}>
          <Ionicons name={direction === 'in' ? 'add' : 'remove'} size={22} color={resident.text} />
        </Pressable>
      </View>)}
    </View>
    {onRecenter ? <Pressable accessibilityRole="button" accessibilityLabel="Recenter map on pinned location" onPress={onRecenter} style={[styles.button, styles.pill, surface]}>
      <Ionicons name="locate-outline" size={22} color={resident.accentText} />
    </Pressable> : null}
  </View>;
}
const styles = StyleSheet.create({
  row: { position: 'absolute', left: 16, right: 16, bottom: 24, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 },
  column: { position: 'absolute', top: 12, right: 12, gap: 16 },
  pill: { flexDirection: 'row', borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  labeled: { minHeight: 44, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  label: { fontSize: 14, fontWeight: '700' }, divider: { width: 1, alignSelf: 'stretch' },
});
