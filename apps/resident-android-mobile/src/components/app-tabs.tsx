import { Ionicons } from '@expo/vector-icons';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CountBadge } from '@/components/count-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

/** Base Ionicons name per tab — the outline variant is used when inactive and the solid
 * fill when active, which is what makes the selected tab read at a glance even before
 * you notice the color. */
type TabIcon = 'home' | 'clipboard' | 'location' | 'heart' | 'notifications' | 'settings';

// 6-tab bottom bar confirmed against the design file (see the plan's Design Reference
// Review) — Home, Services, Maps, Health, Reports, Settings. "Maps" is the Emergency &
// DRRM Info section under a shorter tab label; "Reports" is the Incident Reporting
// section (titled "Reports and Announcements" — Announcements lives as a sub-tab there,
// not its own bottom-tab item).
//
// Built on expo-router/ui's custom-tabs primitives — the same foundation
// app-tabs.web.tsx already used — instead of NativeTabs (expo-router/unstable-native-
// tabs). NativeTabs renders the OS's own native tab bar, which supports at most one
// system-styled badge per tab; the Reports tab needs three simultaneously-visible,
// independently-colored badges (active/resolved/announcements unread counts) stacked
// above one icon, which a native tab bar cannot render. Rebuilding on custom tabs also
// puts native and web on the same rendering model instead of two different tab-bar
// technologies, per the requirement.
export default function AppTabs() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs>
      <TabSlot />
      <TabList asChild>
        {/* StyleSheet.flatten is required, not cosmetic: TabList asChild renders its
            child through expo-router's <Slot>, which throws in dev if that child's
            `style` prop is an array ("You are passing an array of styles to a child of
            <Slot>"). Keep this a single flattened object. */}
        <View
          style={StyleSheet.flatten([
            styles.bar,
            {
              backgroundColor: theme.background,
              borderTopColor: theme.backgroundSelected,
              paddingBottom: Math.max(insets.bottom, Spacing.two),
            },
          ])}>
          <TabTrigger name="home" href="/home" asChild>
            <TabButton icon="home">Home</TabButton>
          </TabTrigger>
          <TabTrigger name="services" href="/services" asChild>
            <TabButton icon="clipboard">Services</TabButton>
          </TabTrigger>
          <TabTrigger name="maps" href="/maps" asChild>
            <TabButton icon="location">Maps</TabButton>
          </TabTrigger>
          <TabTrigger name="health" href="/health" asChild>
            <TabButton icon="heart">Health</TabButton>
          </TabTrigger>
          <TabTrigger name="reports" href="/reports" asChild>
            <TabButton icon="notifications" showUnreadBadges>
              Reports
            </TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">Settings</TabButton>
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  children,
  icon,
  isFocused,
  showUnreadBadges,
  ...props
}: TabTriggerSlotProps & {
  icon: TabIcon;
  /** Only the Reports tab renders the three live-count badges above its icon. */
  showUnreadBadges?: boolean;
}) {
  const theme = useTheme();
  const color = isFocused ? theme.primary : theme.textSecondary;
  // Cheap context read (no new subscriptions) — safe to call even on tabs that don't
  // render the badges, keeping this one component's hook usage unconditional.
  const { activeReportsCount, resolvedUnreadCount, announcementsUnreadCount } = useUnreadCounts();

  // 0 = inactive, 1 = active. One shared value drives the pill and the icon lift together
  // so they can never animate out of step.
  const progress = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(isFocused ? 1 : 0, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [isFocused, progress]);

  // The highlight pill grows horizontally out of the icon rather than just fading, which
  // reads as the selection moving between tabs instead of two unrelated cross-fades.
  const pillStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scaleX: 0.55 + progress.value * 0.45 }],
  }));

  // Slight lift + scale on the icon itself — the part that makes the bar feel responsive
  // rather than static.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -2 * progress.value }, { scale: 1 + 0.08 * progress.value }],
  }));

  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <View style={styles.iconArea}>
        {/* Highlight sits behind the icon. `${color}2E` is ~18% alpha — the same
            hex-suffix alpha convention SettingsIcon and StatusBadge already use. */}
        <Animated.View
          style={[styles.pill, { backgroundColor: `${theme.primary}2E` }, pillStyle]}
          pointerEvents="none"
        />
        <Animated.View style={iconStyle} pointerEvents="none">
          <Ionicons name={isFocused ? icon : `${icon}-outline`} size={22} color={color} />
        </Animated.View>

        {showUnreadBadges && (
          <View style={styles.badgeRow} pointerEvents="none">
            <CountBadge count={activeReportsCount} background={theme.accentOrange} />
            <CountBadge count={resolvedUnreadCount} background={theme.accentGreen} />
            <CountBadge count={announcementsUnreadCount} background={theme.accentRed} />
          </View>
        )}
      </View>

      <ThemedText
        type={isFocused ? 'smallBold' : 'small'}
        numberOfLines={1}
        style={[styles.label, { color }]}>
        {children}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    // Room above the icons for the badge row to sit in without clipping.
    paddingTop: 14,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.6,
  },
  iconArea: {
    width: 56,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 15,
  },
  // Always-visible slot for up to 3 stacked badges — CountBadge itself renders nothing
  // at count 0, so the row's width just shrinks/grows as counts come and go.
  badgeRow: {
    position: 'absolute',
    top: -11,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
});
