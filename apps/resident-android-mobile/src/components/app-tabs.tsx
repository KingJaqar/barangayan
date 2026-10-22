import { Ionicons } from '@expo/vector-icons';
import { Tabs, usePathname } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CountBadge } from '@/components/count-badge';
import { DrrmTabIcon } from '@/components/drrm-tab-icon';
import { HomeTabIcon } from '@/components/home-tab-icon';
import { ServicesTabIcon } from '@/components/services-tab-icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';
import { useFloatingTabLayout } from '@/hooks/use-floating-tab-layout';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';

const TABS = [
  { name: 'home', label: 'Home', icon: 'home' },
  { name: 'services', label: 'Services', icon: 'clipboard' },
  { name: 'drrm', label: 'DRRM' },
  { name: 'maps', label: 'Maps', icon: 'location' },
  { name: 'health', label: 'Health', icon: 'heart' },
  { name: 'reports', label: 'Reports', icon: 'warning' },
] as const;
export default function ResidentTabs() {
  const theme = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  return <Tabs
    initialRouteName="home"
    backBehavior="history"
    tabBar={props => <FloatingTabBar {...props} />}
    screenOptions={{
      headerShown: false,
      // Switching Android tabs should replace the scene in place. Crossfading
      // different layouts briefly overlays the outgoing content under the new
      // header and makes the screen appear to jump. The bar indicator still slides.
      animation: Platform.OS === 'android' || reducedMotion ? 'none' : 'fade',
      sceneStyle: { backgroundColor: theme.background },
    }}>
    {TABS.map(tab => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
    <Tabs.Screen name="settings" options={{ href: null }} />
    <Tabs.Screen name="announcements" options={{ href: null }} />
    <Tabs.Screen name="search" options={{ href: null }} />
  </Tabs>;
}
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const floatingInset = useFloatingTabInset(true);
  const pathname = usePathname();
  const { activeReportsCount, resolvedUnreadCount } = useUnreadCounts();
  const { setBarHeight, barHeight, mapNavHidden, mapNavProgress } = useFloatingTabLayout();
  const mapRoute = pathname === '/drrm' || pathname === '/home/emergency-info';
  const hidden = mapRoute && mapNavHidden;
  const barMotion = useAnimatedStyle(() => ({ transform: [{ translateY: mapRoute ? (mapNavProgress?.value ?? 0) * (barHeight + Math.max(insets.bottom, 12) + 8) : 0 }] }));
  const reducedMotion = useResidentReducedMotion(true);
  const [width, setWidth] = useState(0);
  const selectedRoute = state.routes[state.index];
  const selected = TABS.findIndex(tab => tab.name === selectedRoute?.name);
  const position = useSharedValue(Math.max(0, selected));
  const opacity = useSharedValue(selected >= 0 ? 1 : 0);
  useEffect(() => {
    position.value = reducedMotion ? Math.max(0, selected) : withTiming(Math.max(0, selected), { duration: 220, easing: Easing.bezier(0.23, 1, 0.32, 1) });
    opacity.value = selected >= 0 ? 1 : 0;
    return () => { cancelAnimation(position); cancelAnimation(opacity); };
  }, [selected, reducedMotion, position, opacity]);
  const indicator = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: position.value * width / TABS.length }],
  }));
  if (!floatingInset) return null;
  return <Animated.View pointerEvents={hidden ? 'none' : 'box-none'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} style={[{
    backgroundColor: 'transparent',
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingBottom: Math.max(insets.bottom, 12),
    paddingLeft: 12 + insets.left,
    paddingRight: 12 + insets.right,
    paddingTop: 8,
  }, barMotion]}>
    {/* Root screens scroll beneath the bar and reserve clearance for their controls. */}
    <View accessibilityRole="tablist" accessibilityLabel="Primary navigation"
      style={[styles.bar, { backgroundColor: theme.resident.surface, borderColor: theme.resident.border }]}
      onLayout={event => {
        const { width: barWidth, height } = event.nativeEvent.layout;
        const next = Math.max(0, barWidth - 14);
        setWidth(current => current === next ? current : next);
        setBarHeight(height);
      }}>
      <Animated.View pointerEvents="none"
        style={[styles.indicator, { width: width / TABS.length, backgroundColor: theme.resident.accentSoft }, indicator]} />
      {TABS.map((tab, index) => {
        const route = state.routes.find(route => route.name === tab.name);
        if (!route) return null;
        const active = selected === index;
        const label = tab.name === 'reports' ? `${tab.label}, ${activeReportsCount} active reports, ${resolvedUnreadCount} unread resolved reports` : tab.label;
        return <Pressable key={tab.name} accessibilityRole="tab" accessibilityLabel={label}
          accessibilityState={{ selected: active }} style={styles.tab}
          onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented && !active) navigation.navigate(route.name);
          }}
          onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}>
          <TabContent tab={tab} active={active} reducedMotion={reducedMotion} badges={tab.name === 'reports' ? (
              <View style={styles.badges} pointerEvents="none">
                <CountBadge count={activeReportsCount} background={theme.accentOrange} presentation="resident" />
                <CountBadge count={resolvedUnreadCount} background={theme.accentGreen} presentation="resident" />
              </View>
            ) : null} />
        </Pressable>;
      })}
    </View>
  </Animated.View>;
}

function TabContent({ tab, active, reducedMotion, badges }: { tab: (typeof TABS)[number]; active: boolean; reducedMotion: boolean; badges: ReactNode }) {
  const { resident } = useTheme();
  const progress = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    progress.value = reducedMotion ? Number(active) : withTiming(Number(active), { duration: 150, easing: Easing.bezier(0.4, 0, 0.2, 1) });
    return () => cancelAnimation(progress);
  }, [active, reducedMotion, progress]);
  const inactiveIcon = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const activeIcon = useAnimatedStyle(() => ({ opacity: progress.value }));
  const textColor = useAnimatedStyle(() => ({ color: interpolateColor(progress.value, [0, 1], [resident.muted, resident.accentText]) }));
  return <>
    <View style={styles.icon} accessible={false} importantForAccessibility="no-hide-descendants">
      <Animated.View style={[StyleSheet.absoluteFill, inactiveIcon]}>
        {tab.name === 'home' ? <HomeTabIcon size={24} color={resident.muted} /> : tab.name === 'services' ? <ServicesTabIcon size={24} color={resident.muted} /> : tab.name === 'drrm' ? <DrrmTabIcon size={24} color={resident.muted} /> : <Ionicons name={`${tab.icon}-outline`} size={24} color={resident.muted} />}
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, activeIcon]}>
        {tab.name === 'home' ? <HomeTabIcon size={24} color={resident.accentText} /> : tab.name === 'services' ? <ServicesTabIcon size={24} color={resident.accentText} /> : tab.name === 'drrm' ? <DrrmTabIcon size={24} color={resident.accentText} /> : <Ionicons name={tab.name === 'health' ? tab.icon : `${tab.icon}-outline`} size={24} color={resident.accentText} />}
      </Animated.View>
      {badges}
    </View>
    <ThemedText type={active ? 'smallBold' : 'small'} style={styles.label}>
      <Animated.Text style={textColor}>{tab.label}</Animated.Text>
    </ThemedText>
  </>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', padding: 6, borderWidth: 1, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  indicator: { position: 'absolute', top: 7, bottom: 7, left: 7, borderRadius: 24 },
  tab: { flex: 1, minWidth: 0, minHeight: 54, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 8 },
  icon: { width: 24, height: 24 },
  label: { fontSize: 11, lineHeight: 16, textAlign: 'center' },
  badges: { position: 'absolute', top: -8, left: 14, flexDirection: 'row', gap: 2 },
});
