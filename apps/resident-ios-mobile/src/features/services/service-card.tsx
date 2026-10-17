import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { SymbolIcon } from '../../components/ui';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { describeService, serviceIcon, type CatalogueRow } from './catalog';

/** One catalogue entry: icon, name, server-authored fee and processing labels, opening its detail. */
export function ServiceCard({ row }: { row: CatalogueRow }) {
  const colors = useColors();
  const type = useType();
  const entry = describeService(row);
  return <Link href={{ pathname: '/services/[id]', params: { id: row.id } }} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={`${row.name}. ${entry.priceLabel}. ${entry.processingLabel}`}
      style={({ pressed }) => ({ minHeight: layout.listRowMin, flexDirection: 'row', alignItems: 'center', gap: space[3], padding: space[4], backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, borderCurve: 'continuous', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ width: 44, height: 44, borderRadius: radius.md, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surfaceSelected }}>
        <SymbolIcon name={serviceIcon(row)} color={colors.primary} size={22} />
      </View>
      <View style={{ flex: 1, gap: space[1] }}>
        <Text style={[type.headline, { color: colors.textPrimary }]}>{row.name}</Text>
        <Text style={[type.subheadline, { color: colors.textSecondary }]}>{entry.processingLabel}</Text>
        <Text style={[type.subheadline, { color: colors.primary, fontWeight: '600' }]}>{entry.priceLabel}</Text>
      </View>
      <SymbolIcon name="chevron.right" color={colors.textTertiary} size={14} />
    </Pressable>
  </Link>;
}
