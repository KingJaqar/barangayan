import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { getResidentTheme } from '@/constants/resident-theme';
import { useTheme } from '@/hooks/use-theme';
import { useThemePreference } from '@/hooks/use-theme-preference';

export interface MapPlace {
  id: string; title: string; label: string; detail: string | null; color: string;
  icon: keyof typeof Ionicons.glyphMap;
}

/** M07: exit the previous card/controls before entering the latest requested selection. */
export function MapSelectionOverlay({ place, controls, onClose, reducedMotion, maxHeight, renderPlace, compact = false }: {
  place: MapPlace | null; controls: ReactNode; onClose: () => void; reducedMotion: boolean; maxHeight: number; renderPlace?: (place: MapPlace) => ReactNode; compact?: boolean;
}) {
  const { resident } = useTheme();
  const { scheme } = useThemePreference();
  const [shown, setShown] = useState(place);
  const displayed = useRef(place);
  const latest = useRef(place);
  latest.current = place;
  const progress = useRef(new Animated.Value(1)).current;
  const targetId = place?.id ?? null;
  useEffect(() => {
    let active = true;
    const animate = (toValue: number, card: boolean, done?: () => void) => {
      const duration = reducedMotion ? (compact ? 0 : 100) : compact ? (toValue ? 180 : 110) : card ? 220 : 180;
      Animated.timing(progress, { toValue, duration,
        easing: Easing.bezier(0.23, 1, 0.32, 1), useNativeDriver: true,
      }).start(({ finished }) => { if (active && finished) done?.(); });
    };
    if ((displayed.current?.id ?? null) === targetId) animate(1, displayed.current !== null);
    else animate(0, displayed.current !== null, () => {
      displayed.current = latest.current;
      setShown(latest.current);
      animate(1, latest.current !== null);
    });
    return () => { active = false; progress.stopAnimation(); };
  }, [targetId, reducedMotion, compact, progress]);
  const content = shown && place?.id === shown.id ? place : shown;
  const current = (shown?.id ?? null) === targetId;
  const tone = getResidentTheme(scheme, content?.color ?? resident.accent);
  return <Animated.View pointerEvents={current ? 'auto' : 'none'}
    accessibilityElementsHidden={!current} importantForAccessibility={current ? 'auto' : 'no-hide-descendants'}
    style={{ opacity: progress, transform: reducedMotion ? [] : [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [compact ? 4 : content ? 12 : 8, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [!compact && content ? 0.98 : 1, 1] }) },
    ] }}>
    {content && renderPlace ? renderPlace(content) : content ? <View style={[styles.card, compact && styles.compactCard, { backgroundColor: resident.card, borderColor: resident.border, maxHeight }]}>
      <View style={[styles.icon, compact && styles.compactIcon, { backgroundColor: tone.accent }]}><Ionicons name={content.icon} size={compact ? 18 : 22} color={tone.onAccent} accessible={false} /></View>
      <ScrollView style={styles.copy} contentContainerStyle={{ gap: 2 }}>
        <ThemedText style={[styles.label, { color: tone.accentText }]}>{content.label}</ThemedText>
        <ThemedText style={[styles.title, { color: resident.text }]}>{content.title}</ThemedText>
        {content.detail ? <ThemedText style={[styles.detail, { color: resident.muted }]}>{content.detail}</ThemedText> : null}
      </ScrollView>
      <Pressable hitSlop={6} accessibilityRole="button" accessibilityLabel="Close selected location" onPress={onClose}
        style={({ pressed }) => [styles.close, compact && styles.compactClose, { backgroundColor: pressed ? resident.pressed : resident.surface }]}>
        <Ionicons name="close" size={16} color={resident.text} accessible={false} />
      </Pressable>
    </View> : controls}
  </Animated.View>;
}
const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 16, padding: 14, borderWidth: 1, elevation: 4 },
  compactCard: { gap: 8, padding: 10, borderRadius: 12 }, compactIcon: { width: 36, height: 36, borderRadius: 10 }, compactClose: { width: 44, height: 44, borderRadius: 22 },
  icon: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1, flexShrink: 1 },
  label: { fontSize: 12, lineHeight: 17, fontWeight: '700' }, title: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  detail: { fontSize: 12.5, lineHeight: 18 }, close: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
