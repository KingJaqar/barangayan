import { Pressable, ScrollView, View } from 'react-native';
import { Body, StatusBadge, SymbolIcon, type StatusTone } from '../../components/ui';
import { layout, radius, space, useColors } from '../../lib/theme';
import {
  AVAILABILITY_LABEL, updatedLabel, type CenterAvailability, type CenterRecord, type DistanceDisplay, type Occupancy, type OccupancyLevel,
} from './center-model';

const LEVEL_TONE: Record<OccupancyLevel, StatusTone> = { unknown: 'neutral', normal: 'success', high: 'warning', full: 'danger' };
const AVAILABILITY_TONE: Record<CenterAvailability, StatusTone> = { available: 'success', unknown: 'neutral', unavailable: 'danger' };

/** Occupancy as a bar, a percentage or FULL, and the counts, so the level never depends on colour. An unknown capacity shows no bar. */
export function OccupancyMeter({ occupancy }: { occupancy: Occupancy }) {
  const colors = useColors();
  const tone = LEVEL_TONE[occupancy.level];
  const color = tone === 'neutral' ? colors.textSecondary : colors[tone];
  return <View accessible accessibilityLabel={`Occupancy: ${occupancy.headline}. ${occupancy.detail}`} style={{ gap: space[1] }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space[2] }}>
      <Body role="subheadline" tone="secondary">Occupancy</Body>
      <Body role="subheadline">{occupancy.headline}</Body>
    </View>
    {occupancy.percent !== null && <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View style={{ height: 8, width: `${Math.min(100, occupancy.percent)}%`, backgroundColor: color }} />
    </View>}
    <Body role="footnote" tone="secondary">{occupancy.detail}</Body>
  </View>;
}

export function FacilityTags({ record }: { record: CenterRecord }) {
  const colors = useColors();
  if (record.facilities.length === 0) return null;
  return <View accessible accessibilityLabel={`Facilities: ${record.facilities.map((facility) => facility.label).join(', ')}`} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
    {record.facilities.map((facility) => <View key={facility.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], paddingHorizontal: space[2], paddingVertical: space[1], borderRadius: radius.xl, backgroundColor: colors.surfaceSelected }}>
      <SymbolIcon name={facility.symbol} color={colors.textSecondary} size={13} />
      <Body role="caption" tone="secondary">{facility.label}</Body>
    </View>)}
  </View>;
}

/** One center: name, verification, address, distance, occupancy, facilities and when the figures last changed. */
export function CenterCard({ record, display, selected, now, onSelect }: { record: CenterRecord; display: DistanceDisplay; selected: boolean; now: number; onSelect: () => void }) {
  const colors = useColors();
  const label = [record.name, record.verified ? 'Verified' : null, record.address, display.text, `Occupancy ${record.occupancy.headline}, ${record.occupancy.detail}`, AVAILABILITY_LABEL[record.availability]].filter(Boolean).join('. ');
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected }} accessibilityHint="Selects this center and shows its details" onPress={onSelect}
    style={{ gap: space[2], padding: space[4], borderRadius: radius.md, borderCurve: 'continuous', borderWidth: selected ? 2 : 1, borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.surfaceSelected : colors.surface }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
      <View style={{ flex: 1 }}><Body role="headline">{record.name}</Body></View>
      {record.verified && <SymbolIcon name="checkmark.seal" color={colors.success} size={18} />}
    </View>
    {!!record.address && <Body tone="secondary" role="subheadline">{record.address}</Body>}
    <Body role="subheadline" tone={display.kind === 'unreachable' ? 'danger' : 'secondary'}>{display.text}</Body>
    <OccupancyMeter occupancy={record.occupancy} />
    <StatusBadge label={AVAILABILITY_LABEL[record.availability]} icon={record.availability === 'unavailable' ? 'xmark.circle' : record.availability === 'available' ? 'checkmark.circle' : 'questionmark.circle'} tone={AVAILABILITY_TONE[record.availability]} />
    <FacilityTags record={record} />
    <Body role="footnote" tone="secondary">{updatedLabel(record.updatedAt, now)}</Body>
  </Pressable>;
}

/** The horizontal center picker of the map view: one button per center, nearest first when that is on. */
export function CenterPicker({ items, selectedId, onSelect }: { items: readonly { id: string; name: string; hint: string | null }[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const colors = useColors();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel="Evacuation centers" contentContainerStyle={{ gap: space[2] }}>
    {items.map((item) => {
      const active = item.id === selectedId;
      return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={item.hint ? `${item.name}, ${item.hint}` : item.name} accessibilityState={{ selected: active }} onPress={() => onSelect(item.id)}
        style={{ minHeight: layout.controlMin, maxWidth: 240, justifyContent: 'center', paddingHorizontal: space[3], paddingVertical: space[2], borderRadius: radius.xl, borderCurve: 'continuous', borderWidth: 1, borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.surfaceSelected : colors.surface }}>
        <Body role="subheadline">{item.name}</Body>
        {!!item.hint && <Body role="caption" tone="secondary">{item.hint}</Body>}
      </Pressable>;
    })}
  </ScrollView>;
}
