import { Ionicons } from '@expo/vector-icons';
import { ANNOUNCEMENT_CATEGORY_META, type AnnouncementCategory, type Tables } from '@barangayan/shared';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Announcement = Tables<'announcements'>;

/** Formats an ISO datetime as an absolute date & time, e.g. "August 15, 2026, 9:00 AM". */
function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short' }).format(
    new Date(iso),
  );
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMinutes = Math.floor(diffMs / 60_000);
  if (diffMinutes < 60) return diffMinutes <= 1 ? 'Just now' : `${diffMinutes} minutes ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return diffHours === 1 ? '1 hour ago' : `${diffHours} hours ago`;
  const diffDays = Math.floor(diffHours / 24);
  return diffDays === 1 ? '1 day ago' : `${diffDays} days ago`;
}

/**
 * Bottom sheet with an announcement's full detail — opened by tapping an
 * AnnouncementCard.
 *
 * Animation is entirely hand-driven with Reanimated shared values (never the
 * `entering`/`exiting`/`layout` props — see the memory note on those getting stuck
 * invisible on web) instead of RN Modal's built-in `animationType="slide"`: the native
 * slide is a fixed system curve with no control over easing/duration and nothing to
 * await before the modal actually unmounts, so the close never looked as fluid as the
 * open. Here the sheet springs up from off-screen on open, and on close we keep the
 * native `Modal` mounted (`visible={mounted}`, not the `visible` prop directly) while an
 * eased slide-down + backdrop fade plays out, only unmounting once that animation
 * reports finished — so both directions play a full, uninterrupted motion.
 */
export function AnnouncementModal({
  visible,
  announcement,
  onClose,
}: {
  visible: boolean;
  /** The caller keeps this populated with the last-opened announcement even after
   * `visible` goes false, so the sheet's content doesn't blank out mid slide-down —
   * conditionally unmounting it here (rather than just hiding via `visible`) would cut
   * the close animation short. */
  announcement: Announcement | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();

  // The native Modal itself stays mounted for the whole close animation — it's only
  // actually torn down once the slide-down + fade finish, via the withTiming callback
  // below. Without this split, setting `visible` false directly would yank the Modal
  // (and the animation playing inside it) off-screen instantly.
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(windowHeight);
  const backdropOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      backdropOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      // A slightly under-damped spring reads as far smoother/more "alive" than a linear
      // slide — snappy on the way in, one soft settle, no visible overshoot.
      translateY.value = withSpring(0, { damping: 32, stiffness: 320, mass: 0.9, overshootClamping: false });
    } else {
      backdropOpacity.value = withTiming(0, { duration: 200, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(
        windowHeight,
        { duration: 260, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setMounted)(false);
        },
      );
    }
    // windowHeight deliberately excluded — it only seeds the off-screen resting position,
    // re-running this on a rotation mid-animation would restart the motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropAnimatedStyle = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));
  const sheetAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.value }] }));

  const category = (announcement?.category ?? 'general') as AnnouncementCategory;
  const meta = ANNOUNCEMENT_CATEGORY_META[category] ?? ANNOUNCEMENT_CATEGORY_META.general;
  const { color, icon, label } = meta;
  // Falls back to the card's short `body` for announcements composed before
  // `detailed_description` existed, or left blank in the admin compose form.
  const detail = announcement?.detailed_description?.trim() || announcement?.body || '';

  return (
    <Modal visible={mounted} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close announcement">
        <Animated.View pointerEvents="none" style={[styles.dim, backdropAnimatedStyle]} />

        <Animated.View style={sheetAnimatedStyle}>
          <Pressable
            style={[
              styles.sheet,
              { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.four, maxHeight: windowHeight * 0.82 },
            ]}
            onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />

            {announcement ? (
              <>
                <View style={styles.header}>
                  <View style={[styles.categoryChip, { backgroundColor: `${color}1A` }]}>
                    <Ionicons name={icon as any} size={13} color={color} />
                    <ThemedText type="small" style={[styles.categoryLabel, { color }]}>
                      {label}
                    </ThemedText>
                  </View>
                  <Pressable
                    onPress={onClose}
                    accessibilityRole="button"
                    accessibilityLabel="Close"
                    hitSlop={8}
                    style={[styles.closeBtn, { backgroundColor: theme.backgroundElement }]}>
                    <Ionicons name="close" size={18} color={theme.textSecondary} />
                  </Pressable>
                </View>

                <ThemedText type="heading" style={styles.title}>
                  {announcement.title}
                </ThemedText>

                <View style={styles.metaRow}>
                  <Ionicons name="time-outline" size={13} color={theme.textSecondary} />
                  <ThemedText type="small" themeColor="textSecondary">
                    {timeAgo(announcement.published_at)} · {formatDateTime(announcement.published_at)}
                  </ThemedText>
                </View>

                <View style={[styles.divider, { backgroundColor: theme.backgroundSelected }]} />

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                  <ThemedText type="body" style={styles.detail}>
                    {detail}
                  </ThemedText>
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  dim: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D1D5DB',
    alignSelf: 'center',
    marginBottom: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 20,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: 5,
  },
  categoryLabel: {
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 19,
    lineHeight: 25,
    letterSpacing: -0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 2,
  },
  scrollContent: {
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  detail: {
    lineHeight: 22,
  },
});
