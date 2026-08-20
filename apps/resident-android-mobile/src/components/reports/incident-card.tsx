import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { incidentStatusMeta } from '@/constants/incident-status';
import { Spacing } from '@/constants/theme';
import type { MyIncidentRow } from '@/hooks/use-my-incidents';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

// ─── Status badge ───────────────────────────────────────────────────────────

function IncidentStatusBadge({ status }: { status: string }) {
  const cfg = incidentStatusMeta(status);
  return (
    <View style={[badgeStyles.pill, { backgroundColor: cfg.bg }]}>
      <Ionicons name={cfg.icon as keyof typeof Ionicons.glyphMap} size={10} color={cfg.fg} />
      <ThemedText style={[badgeStyles.label, { color: cfg.fg }]}>
        {cfg.label}
      </ThemedText>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
    flexShrink: 0,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    letterSpacing: 0.1,
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

const THUMB_SIZE = 52;

// Note: deliberately no per-row `entering` (Reanimated) animation here — nesting one
// inside a FlatList row got stuck permanently invisible in testing (the entering
// transition's pre-animation `visibility: hidden` state never resolved once the row
// was virtualized/recycled). The skeleton shimmer already carries the loading-in
// motion; rows just appear once data resolves.
//
// Compact, minimal card — a photo thumbnail is only reserved when one actually exists
// (the old version always reserved an 80×80 placeholder box even for photo-less
// reports, the majority of them); when there's no photo the category shows instead as a
// small icon + label chip inline with the date, reclaiming that space for text.
export function IncidentCard({ incident }: { incident: MyIncidentRow }) {
  const theme = useTheme();
  const { markIncidentRead, markIncidentUnread } = useUnreadCounts();

  const category = incident.incident_categories;
  const catIcon = (category?.icon ?? 'alert-circle-outline') as keyof typeof Ionicons.glyphMap;
  const catColor = category?.color ?? theme.primary;
  const catLabel = category?.name;

  const firstPhoto = incident.photo_urls?.[0] ?? null;
  const isResolved = incident.status === 'resolved';
  const isUnread = isResolved && !incident.resolved_read_at;

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: '/(app)/reports/[incidentId]',
          params: { incidentId: incident.id },
        })
      }
      accessibilityRole="button"
      accessibilityLabel={`View details for ${incident.title}`}
      style={({ pressed }) => [pressed && styles.pressed]}>
      <ThemedView
        type="backgroundElement"
        style={[styles.card, { borderColor: theme.backgroundSelected }]}>
        {firstPhoto && (
          <Image source={{ uri: firstPhoto }} style={styles.thumb} resizeMode="cover" />
        )}

        <View style={styles.content}>
          {/* Title row — title left, status badge right */}
          <View style={styles.titleRow}>
            <ThemedText type="default" numberOfLines={1} style={styles.title}>
              {incident.title}
            </ThemedText>
            <IncidentStatusBadge status={incident.status} />
          </View>

          {/* Description — one line only; the detail screen has the full text. */}
          {!!incident.description && (
            <ThemedText themeColor="textSecondary" numberOfLines={1} style={styles.description}>
              {incident.description}
            </ThemedText>
          )}

          {/* Meta row — category (only when there's no thumbnail to show it on) •
              date • confirmations, all on one compact line */}
          <View style={styles.metaRow}>
            {!firstPhoto && (
              <>
                <Ionicons name={catIcon} size={11} color={catColor} />
                {!!catLabel && (
                  <ThemedText numberOfLines={1} style={[styles.metaText, styles.categoryText, { color: catColor }]}>
                    {catLabel}
                  </ThemedText>
                )}
                <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
              </>
            )}
            <Ionicons name="calendar-outline" size={11} color={theme.textSecondary} />
            <ThemedText themeColor="textSecondary" style={styles.metaText}>
              {formatDate(incident.created_at)}
            </ThemedText>
            {incident.confirmation_count > 0 && (
              <>
                <View style={[styles.dot, { backgroundColor: theme.textSecondary }]} />
                <Ionicons name="people-outline" size={11} color={theme.textSecondary} />
                <ThemedText themeColor="textSecondary" style={styles.metaText}>
                  {incident.confirmation_count}
                </ThemedText>
              </>
            )}
          </View>

          {/* Resolved reports only: per-item mark-as-read / mark-as-unread icons. Both
              stay tappable (idempotent updates) — the highlighted one just reflects this
              resident's current read state for this report. */}
          {isResolved && (
            <View style={styles.iconActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark as read"
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  markIncidentRead(incident.id);
                }}
                style={[styles.iconBtn, !isUnread && { backgroundColor: `${theme.primary}1F` }]}>
                <Ionicons
                  name="mail-open-outline"
                  size={13}
                  color={!isUnread ? theme.primary : theme.textSecondary}
                />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Mark as unread"
                hitSlop={8}
                onPress={(e) => {
                  e.stopPropagation();
                  markIncidentUnread(incident.id);
                }}
                style={[styles.iconBtn, isUnread && { backgroundColor: `${theme.accentRed}1F` }]}>
                <Ionicons
                  name="mail-unread-outline"
                  size={13}
                  color={isUnread ? theme.accentRed : theme.textSecondary}
                />
              </Pressable>
            </View>
          )}
        </View>

        <Ionicons name="chevron-forward" size={15} color={theme.backgroundSelected} style={styles.chevron} />
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two + 4,
    gap: Spacing.two + 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.99 }],
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: 10,
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    letterSpacing: -0.1,
  },
  description: {
    fontSize: 12,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  categoryText: {
    fontWeight: '700',
    flexShrink: 1,
  },
  metaText: {
    fontSize: 11,
    lineHeight: 15,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    opacity: 0.6,
  },
  iconActions: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 2,
  },
  iconBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chevron: {
    flexShrink: 0,
  },
});
