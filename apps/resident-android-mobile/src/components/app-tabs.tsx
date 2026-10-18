import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Keyboard, Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CountBadge } from '@/components/count-badge';
import { DrrmTabIcon } from '@/components/drrm-tab-icon';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import { useFloatingTabInset } from '@/hooks/use-floating-tab-inset';

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
  const reducedMotion = useReducedMotion();
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
  const floatingInset = useFloatingTabInset();
  const { activeReportsCount, resolvedUnreadCount } = useUnreadCounts();
  const [keyboardVisible, setKeyboardVisible] = useState(Keyboard.isVisible());
  const [width, setWidth] = useState(0);
  const selected = TABS.findIndex(tab => tab.name === state.routes[state.index].name);
  const position = useSharedValue(Math.max(0, selected));
  const opacity = useSharedValue(selected >= 0 ? 1 : 0);
  useEffect(() => {
    position.value = withTiming(Math.max(0, selected), { duration: 220 });
    opacity.value = withTiming(selected >= 0 ? 1 : 0, { duration: 160 });
  }, [selected, position, opacity]);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const indicator = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: position.value * width / TABS.length }],
  }));
  if (keyboardVisible || !floatingInset) return null;
  return <View pointerEvents="box-none" style={{
    backgroundColor: 'transparent',
    ...(floatingInset ? { position: 'absolute', bottom: 0, left: 0, right: 0 } as const : {}),
    paddingBottom: Math.max(insets.bottom, 8),
    paddingHorizontal: 12 + Math.max(insets.left, insets.right),
    paddingTop: 8,
  }}>
    {/* Root screens scroll beneath the bar and reserve clearance for their controls. */}
    <View style={[styles.bar, { backgroundColor: theme.backgroundElement, borderColor: theme.backgroundSelected }]}
      onLayout={event => setWidth(event.nativeEvent.layout.width - 2)}>
      <Animated.View pointerEvents="none"
        style={[styles.indicator, { width: width / TABS.length, backgroundColor: `${theme.primary}24` }, indicator]} />
      {TABS.map((tab, index) => {
        const route = state.routes.find(route => route.name === tab.name);
        if (!route) return null;
        const active = selected === index;
        const color = active ? theme.primary : theme.textSecondary;
        return <Pressable key={tab.name} accessibilityRole="tab" accessibilityLabel={tab.label}
          accessibilityState={{ selected: active }} style={styles.tab}
          onPress={() => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!event.defaultPrevented && !active) navigation.navigate(route.name);
          }}
          onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}>
          {tab.name === 'drrm' ? <DrrmTabIcon color={color} /> : (
            <Ionicons name={active ? tab.icon : `${tab.icon}-outline`} size={23} color={color} />
          )}
          <ThemedText type={active ? 'smallBold' : 'small'} numberOfLines={1}
            style={[styles.label, { color }]}>{tab.label}</ThemedText>
          {tab.name === 'reports' ? (
            <View style={styles.badges} pointerEvents="none">
              <CountBadge count={activeReportsCount} background={theme.accentOrange} />
              <CountBadge count={resolvedUnreadCount} background={theme.accentGreen} />
            </View>
          ) : null}
        </Pressable>;
      })}
    </View>
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', borderWidth: 1, borderRadius: 28, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
  indicator: { position: 'absolute', top: 5, bottom: 5, left: 0, borderRadius: 24 },
  tab: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3, paddingTop: 4 },
  label: { fontSize: 11, lineHeight: 16 },
  badges: { position: 'absolute', top: 0, flexDirection: 'row', gap: 2 },
});
