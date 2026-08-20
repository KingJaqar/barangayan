import { Ionicons } from '@expo/vector-icons';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, View, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { CountBadge } from '@/components/count-badge';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';

/** Base Ionicons name per tab — outline when inactive, solid fill when active. Mirrors
 * the native app-tabs.tsx so the two variants read the same way. */
type TabIcon = 'home' | 'clipboard' | 'location' | 'heart' | 'notifications' | 'settings';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
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
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({
  children,
  icon,
  isFocused,
  showUnreadBadges,
  ...props
}: TabTriggerSlotProps & {
  icon: TabIcon;
  /** Only the Reports tab renders the three live-count badges — same contract as the
   * native app-tabs.tsx, reading the same useUnreadCounts() provider, so the two tab-bar
   * variants can't drift apart on what the counts mean. */
  showUnreadBadges?: boolean;
}) {
  const theme = useTheme();
  const color = isFocused ? theme.primary : theme.textSecondary;
  const { activeReportsCount, resolvedUnreadCount, announcementsUnreadCount } = useUnreadCounts();

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        // Primary-tinted highlight (~18% alpha) makes the active tab obvious instead of
        // relying on the near-neutral backgroundSelected alone — matches the native bar's
        // pill treatment.
        style={[styles.tabButtonView, isFocused && { backgroundColor: `${theme.primary}2E` }]}>
        <View style={styles.iconWrap}>
          <Ionicons name={isFocused ? icon : `${icon}-outline`} size={18} color={color} />
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
          themeColor={isFocused ? undefined : 'textSecondary'}
          style={isFocused ? { color: theme.primary } : undefined}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  // useTheme() (not the raw OS useColorScheme()) so this matches the app's chosen theme
  // preference — same reason app-tabs.tsx (native) does the same.
  const theme = useTheme();

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          Barangayan
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={theme.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.five,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButtonView: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
  },
  iconWrap: {
    // Room above the icon for the badge row to sit in without clipping.
    paddingTop: 10,
  },
  badgeRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 2,
  },
  externalPressable: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    marginLeft: Spacing.three,
  },
});
