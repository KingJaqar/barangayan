import { Link } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { StatusBadge, SymbolIcon } from '../../components/ui';
import type { DriveItem, RegistrationStatus } from '../../data/resident-api';
import { layout, radius, space, useColors, useType } from '../../lib/theme';
import { AVAILABILITY_LABEL, categoryOf, driveAvailability, formatDriveDate, formatTimeRange, stockFraction, stockSummary } from './drive-model';

/** Remaining stock as a bar plus the same facts in words, so the quantity never depends on the bar's color or length. */
export function StockBar({ drive }: { drive: DriveItem }) {
  const colors = useColors();
  const type = useType();
  const fraction = stockFraction(drive);
  return <View accessible accessibilityLabel={stockSummary(drive)} style={{ gap: space[1] }}>
    <Text style={[type.footnote, { color: colors.textSecondary }]}>{stockSummary(drive)}</Text>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 8, borderRadius: 4, backgroundColor: colors.border, overflow: 'hidden' }}>
      <View style={{ width: `${Math.round(fraction * 100)}%`, height: 8, backgroundColor: fraction > 0 ? colors.primary : colors.danger }} />
    </View>
  </View>;
}

/** The drive's category, written out and marked with its configured color. */
export function CategoryLabel({ typeName }: { typeName: string }) {
  const colors = useColors();
  const type = useType();
  const category = categoryOf(typeName);
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
    <View accessibilityElementsHidden importantForAccessibility="no" style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: category.color }} />
    <Text style={[type.footnote, { color: colors.textSecondary }]}>{category.label}</Text>
  </View>;
}

/** Whether the drive can be registered for, as a labeled badge; an existing registration (even a cancelled one, which the server still counts) wins. */
export function AvailabilityBadge({ drive, today, registration }: { drive: DriveItem; today: string; registration: RegistrationStatus | null }) {
  if (registration) return <StatusBadge label={registration === 'cancelled' ? 'Your registration was cancelled' : 'You are registered'} icon={registration === 'cancelled' ? 'xmark.circle' : 'checkmark.circle'} tone={registration === 'cancelled' ? 'neutral' : 'success'} />;
  const availability = driveAvailability(drive, today);
  return <StatusBadge label={AVAILABILITY_LABEL[availability]} icon={availability === 'open' ? 'checkmark.circle' : availability === 'full' ? 'exclamationmark.circle' : 'xmark.circle'} tone={availability === 'open' ? 'success' : availability === 'full' ? 'warning' : 'neutral'} />;
}

/** One drive in a list: category, schedule, place, eligibility, stock and availability. The whole card opens the drive. */
export function DriveCard({ drive, today, registration }: { drive: DriveItem; today: string; registration: RegistrationStatus | null }) {
  const colors = useColors();
  const type = useType();
  const label = `${drive.title}. ${categoryOf(drive.type).label}. ${formatDriveDate(drive.drive_date)}, ${formatTimeRange(drive)}. ${drive.location}. ${stockSummary(drive)}.`;
  return <Link href={{ pathname: '/health/[id]', params: { id: drive.id } }} asChild>
    <Pressable accessibilityRole="link" accessibilityLabel={label} accessibilityHint="Opens the drive details"
      style={({ pressed }) => ({ minHeight: layout.listRowMin, gap: space[2], padding: space[4], backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, borderCurve: 'continuous', opacity: pressed ? 0.7 : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[3] }}>
        <View style={{ flex: 1, gap: space[1] }}>
          <CategoryLabel typeName={drive.type} />
          <Text style={[type.headline, { color: colors.textPrimary }]}>{drive.title}</Text>
        </View>
        <SymbolIcon name="chevron.right" color={colors.textTertiary} size={14} />
      </View>
      <Text style={[type.subheadline, { color: colors.textSecondary }]}>{formatDriveDate(drive.drive_date)} · {formatTimeRange(drive)}</Text>
      <Text style={[type.subheadline, { color: colors.textSecondary }]}>{drive.location}</Text>
      {!!drive.eligible_criteria && <Text style={[type.subheadline, { color: colors.textSecondary }]}>Who can join: {drive.eligible_criteria}</Text>}
      <StockBar drive={drive} />
      <AvailabilityBadge drive={drive} today={today} registration={registration} />
    </Pressable>
  </Link>;
}
