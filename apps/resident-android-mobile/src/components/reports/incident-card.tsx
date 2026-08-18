import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { incidentStatusMeta } from '@/constants/incident-status';
import { Spacing } from '@/constants/theme';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';

// ─── Status badge ───────────────────────────────────────────────────────────

function IncidentStatusBadge({ status }: { status: string }) {
  const cfg = incidentStatusMeta(status);
  return (
    <View style={[badgeStyles.pill, { backgroundColor: cfg.bg }]}>
      <ThemedText style={[badgeStyles.label, { color: cfg.fg }]}>
        {cfg.label}
      </ThemedText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
});

// ─── Category icon overlay ───────────────────────────────────────────────────

/** White-circle icon badge pinned to the bottom-left of the thumbnail. */
function CategoryIconBadge({
  icon,
  color,
}: {
  icon: string;
  color: string;
}) {
  return (
    <View style={iconStyles.circle}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={14}
        color={color}
      />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  circle: {
    position: 'absolute',
    bottom: -6,
    left: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    // subtle lift so it reads above the card surface
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
});

// ─── Date formatter ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Card ────────────────────────────────────────────────────────────────────

export function IncidentCard({ incident }: { incident: MyIncidentRow }) {
  const theme = useTheme();

  const category = incident.incident_categories;
  // Fallback icon/color when category join returns null (uncategorised incident)
  const catIcon  = (category?.icon  ?? 'alert-circle-outline') as keyof typeof Ionicons.glyphMap;
  const catColor = category?.color ?? theme.primary;

  // Use first photo if available, otherwise render the placeholder
  const firstPhoto = incident.photo_urls?.[0] ?? null;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(app)/reports/[incidentId]',
          params: { incidentId: incident.id },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`View details for ${incident.title}`}>
    <ThemedView type="background" style={styles.card}>
      {/* ── Thumbnail ── */}
      <View style={styles.thumbWrap}>
        {firstPhoto ? (
          <Image
            source={{ uri: firstPhoto }}
            style={styles.thumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <CategoryIconBadge icon={catIcon} color={catColor} />
      </View>

      {/* ── Content ── */}
      <View style={styles.content}>
        {/* Title row — title left, badge right */}
        <View style={styles.titleRow}>
          <ThemedText
            type="default"
            numberOfLines={1}
            style={styles.title}>
            {incident.title}
          </ThemedText>
          <IncidentStatusBadge status={incident.status} />
        </View>

        {/* Description */}
        {!!incident.description && (
          <ThemedText
            themeColor="textSecondary"
            numberOfLines={2}
            style={styles.description}>
            {incident.description}
          </ThemedText>
        )}

        {/* Date + confirmation count */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={12} color={theme.textSecondary} />
          <ThemedText themeColor="textSecondary" style={styles.date}>
            {formatDate(incident.created_at)}
          </ThemedText>
          {incident.confirmation_count > 0 && (
            <>
              <Ionicons name="people-outline" size={12} color={theme.textSecondary} style={{ marginLeft: Spacing.two }} />
              <ThemedText themeColor="textSecondary" style={styles.date}>
                {incident.confirmation_count}
              </ThemedText>
            </>
          )}
        </View>
      </View>
    </ThemedView>
    </Pressable>
  );
}

const THUMB_SIZE = 82;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 16,
    padding: 14,
    gap: 14,
    // card elevation
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  thumbWrap: {
    position: 'relative',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    // extra bottom margin so the icon badge has room to overflow
    marginBottom: Spacing.two,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
  },
  thumbPlaceholder: {
    backgroundColor: '#CECECE',
  },
  content: {
    flex: 1,
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  description: {
    fontSize: 13,
    lineHeight: 19,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  date: {
    fontSize: 12,
    lineHeight: 18,
  },
});
