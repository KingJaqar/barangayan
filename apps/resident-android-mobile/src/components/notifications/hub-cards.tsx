import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { CountBadge } from '@/components/count-badge';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { HUB_VIEWS, type HubView } from '@/lib/notification-hub';

const CARD_ICONS: Record<HubView, keyof typeof Ionicons.glyphMap> = {
  all: 'notifications-outline', barangay: 'megaphone-outline', account: 'person-circle-outline', system: 'construct-outline',
};

/** Guests see public views only. `unread` is the category's server count; null shows no badge. */
export function HubCards({ active, unread, signedIn, onSelect }: { active: HubView; unread: Record<HubView, number | null>; signedIn: boolean; onSelect: (view: HubView) => void }) {
  const theme = useTheme();
  const { resident } = theme;
  return <View style={styles.row} accessibilityRole="tablist">
    {HUB_VIEWS.filter(({ key }) => signedIn || key === 'all' || key === 'barangay').map(({ key, label }) => {
      const selected = key === active;
      const count = unread[key];
      return <Pressable key={key} accessibilityRole="tab" accessibilityState={{ selected }}
        accessibilityLabel={count ? `${label}, ${count} unread` : label} onPress={() => onSelect(key)}
        style={({ pressed }) => [styles.card, {
          backgroundColor: selected ? (pressed ? resident.accentPressed : resident.accent) : pressed ? resident.pressed : resident.surface,
          borderColor: selected && resident.accentNeedsOutline ? resident.controlBorder : 'transparent',
        }]}>
        {({ pressed }) => {
          const ink = selected ? (pressed ? resident.onAccentPressed : resident.onAccent) : resident.text;
          return <>
            <View>
              <Ionicons name={CARD_ICONS[key]} size={24} color={ink} accessible={false} />
              <View style={styles.badge}><CountBadge count={count ?? 0} background={theme.accentRed} presentation="resident" size={18} outlineWidth={0} /></View>
            </View>
            <ThemedText numberOfLines={2} style={[styles.label, { color: ink }]}>{label}</ThemedText>
          </>;
        }}
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  card: { flex: 1, minHeight: 72, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 4, borderWidth: 1, borderRadius: 16, paddingHorizontal: 4, paddingVertical: 8 },
  badge: { position: 'absolute', top: -7, right: -9 },
  label: { fontSize: 12.5, lineHeight: 17, fontWeight: '700', textAlign: 'center' },
});
