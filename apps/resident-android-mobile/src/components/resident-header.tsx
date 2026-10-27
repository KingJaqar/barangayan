import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/notification-bell';
import { ThemedText } from '@/components/themed-text';
import { useSearchDraft } from '@/hooks/use-resident-search';
import { useTheme } from '@/hooks/use-theme';
import { getMobileFontFamily } from '@/constants/fonts';
import { useFontPreference } from '@/hooks/use-font-preference';
import { useResidentReducedMotion } from '@/hooks/use-resident-reduced-motion';
import { useUnreadCounts } from '@/hooks/use-unread-counts';
import { useEmergencyMapHeader } from '@/hooks/use-emergency-map-header';
import { useSearchInactivity } from '@/hooks/use-search-inactivity';
import { isSearchableQuery } from '@/lib/resident-search';

const TITLES: Record<string, string> = {
  '/home': 'Home',
  '/services': 'Services',
  '/drrm': 'Emergency & DRRM Info',
  '/home/emergency-info': 'Emergency & DRRM Info',
  '/maps': 'Maps',
  '/health': 'Health',
  '/reports': 'Reports',
  '/announcements': 'Announcements',
  '/settings': 'Settings',
};

/** Stays mounted across navigation so the expanding search keeps its input. */
export function ResidentHeader() {
  const pathname = usePathname();
  const enteringSearch = pathname === '/search';
  const searching = enteringSearch || pathname === '/explore';
  const { active: emergencyMapActive, searchAvoidance } = useEmergencyMapHeader();
  const [mapSearch, setMapSearch] = useState(false);
  const title = TITLES[pathname];
  const theme = useTheme();
  const reducedMotion = useResidentReducedMotion(true);
  const { announcementsUnreadCount } = useUnreadCounts();
  const { fontId } = useFontPreference();
  const insets = useSafeAreaInsets();
  const { query, setQuery, submitSearch, openSearch, editSearch, backFromSearch } = useSearchDraft();
  const searchable = isSearchableQuery(query);
  const input = useRef<TextInput>(null);
  const [width, setWidth] = useState(336);
  const [searchX, setSearchX] = useState(140);
  const progress = useSharedValue(searching ? 1 : 0);
  useEffect(() => {
    progress.value = reducedMotion ? (searching ? 1 : 0) : withTiming(searching ? 1 : 0, { duration: 200 });
    return () => cancelAnimation(progress);
  }, [searching, reducedMotion, progress]);
  // A frame can run after Explore has committed but before this effect's cleanup; focusing there would reopen editing.
  const entering = useRef(enteringSearch);
  entering.current = enteringSearch;
  useEffect(() => {
    if (!enteringSearch) {
      input.current?.blur();
      return;
    }
    const frame = requestAnimationFrame(() => { if (entering.current) input.current?.focus(); });
    return () => cancelAnimationFrame(frame);
  }, [enteringSearch]);
  const fieldStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    left: searchX + 12 + (48 - searchX - 12) * progress.value,
    width: 44 + (width - 40 - 44) * progress.value,
  }));
  const normalStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const closeSearch = () => {
    Keyboard.dismiss();
    backFromSearch();
  };
  const resetSearchIdle = useSearchInactivity(enteringSearch && mapSearch, closeSearch);
  useEffect(() => { if (!searching) setMapSearch(false); }, [searching]);
  // Android Back takes the header's Back path, so leaving search also clears the submitted session.
  const back = useRef(closeSearch);
  back.current = closeSearch;
  useEffect(() => {
    if (!searching) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { back.current(); return true; });
    return () => subscription.remove();
  }, [searching]);
  return <View style={{
    display: title || searching ? 'flex' : 'none',
    backgroundColor: theme.resident.accent,
    paddingTop: insets.top,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  }}>
    <View style={styles.row} onLayout={event => { const next = event.nativeEvent.layout.width; setWidth(current => current === next ? current : next); }}>
      <Animated.View
        style={[styles.normal, normalStyle]}
        pointerEvents={searching ? 'none' : 'auto'}
        accessibilityElementsHidden={searching}
        importantForAccessibility={searching ? 'no-hide-descendants' : 'auto'}>
        <Image source={require('@/assets/logo/barangayan-logo-1024.png')}
          style={styles.logo} contentFit="contain" accessibilityLabel="Barangayan" />
        <ThemedText type="residentHeader" accessibilityRole="header"
          numberOfLines={pathname === '/announcements' || searchAvoidance ? 1 : undefined}
          adjustsFontSizeToFit={pathname === '/announcements' || searchAvoidance}
          minimumFontScale={0.6}
          style={[styles.title, title && title.length > 14 ? styles.longTitle : undefined, { color: theme.resident.onAccent }]}>{title}</ThemedText>
        <View onLayout={event => { const next = event.nativeEvent.layout.x; setSearchX(current => current === next ? current : next); }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search"
            accessibilityState={emergencyMapActive ? { expanded: false } : undefined}
            onPress={() => { setMapSearch(emergencyMapActive); openSearch(pathname); }} style={styles.button}>
            <Ionicons name="search" size={22} color={theme.resident.onAccent} />
          </Pressable>
        </View>
        <HeaderAction label={announcementsUnreadCount > 0 ? `View announcements, ${announcementsUnreadCount} unread` : 'View announcements'}
          selected={pathname === '/announcements'} reducedMotion={reducedMotion}
          onPress={() => router.navigate('/announcements')}>
            <NotificationBell size={22} color={pathname === '/announcements' ? theme.resident.accentText : theme.resident.onAccent} presentation="resident" />
        </HeaderAction>
        <HeaderAction label="Open settings" selected={pathname === '/settings'} reducedMotion={reducedMotion}
          onPress={() => router.navigate('/settings')}>
            <Ionicons name="menu" size={24} color={pathname === '/settings' ? theme.resident.accentText : theme.resident.onAccent} />
        </HeaderAction>
      </Animated.View>
      <View style={styles.searchLayer} pointerEvents={searching ? 'box-none' : 'none'}
        accessibilityElementsHidden={!searching}
        importantForAccessibility={searching ? 'auto' : 'no-hide-descendants'}>
        {searching ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back from search"
            onPress={closeSearch} style={styles.button}>
            <Ionicons name="arrow-back" size={24} color={theme.resident.onAccent} />
          </Pressable>
        ) : null}
        <Animated.View style={[styles.field, fieldStyle]} onTouchStart={resetSearchIdle}>
          <View pointerEvents="none" style={[styles.fieldSurface, { backgroundColor: theme.resident.card }]} />
          {mapSearch ? <Pressable accessibilityRole="button" accessibilityLabel="Collapse header search" accessibilityState={{ expanded: true }} onPress={closeSearch} style={styles.button}>
            <Ionicons name="search" size={18} color={theme.resident.muted} />
          </Pressable> : <Ionicons name="search" size={18} color={theme.resident.muted} />}
          <TextInput
            ref={input} value={query} onChangeText={value => { setQuery(value); resetSearchIdle(); }} maxLength={120} editable={searching}
            // Explore's field is the way back to editing: focusing it reopens the entry with the submitted query.
            onFocus={() => { if (enteringSearch) resetSearchIdle(); else editSearch(); }} onSelectionChange={resetSearchIdle} onKeyPress={resetSearchIdle}
            accessibilityLabel="Search services, announcements and your records"
            placeholder="Search Barangayan" placeholderTextColor={theme.resident.muted}
            returnKeyType="search" autoCorrect={false}
            onSubmitEditing={() => submitSearch(query)} style={[styles.input, { color: theme.resident.text, fontFamily: getMobileFontFamily(fontId) }]} />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search"
              onPress={() => { if (!enteringSearch) { editSearch(''); return; } setQuery(''); input.current?.focus(); }} style={styles.clear}>
              <Ionicons name="close-circle" size={18} color={theme.resident.muted} />
            </Pressable>
          ) : null}
          {enteringSearch ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Submit search" accessibilityState={{ disabled: !searchable }}
              disabled={!searchable} onPress={() => submitSearch(query)} style={styles.submit}>
              <ThemedText type="smallBold" style={{ color: searchable ? theme.resident.accentText : theme.resident.muted }}>Search</ThemedText>
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </View>
  </View>;
}

/** Animate only presentation; the full touch target and unread badge stay stable. */
function HeaderAction({ label, selected, reducedMotion, onPress, children }: {
  label: string;
  selected: boolean;
  reducedMotion: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  const { resident } = useTheme();
  const selection = useSharedValue(Number(selected));
  const press = useSharedValue(0);
  useEffect(() => {
    selection.value = reducedMotion ? Number(selected) : withTiming(Number(selected), {
      duration: selected ? 260 : 180,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
    return () => cancelAnimation(selection);
  }, [selected, reducedMotion, selection]);
  useEffect(() => {
    if (reducedMotion) { cancelAnimation(press); press.value = 0; }
    return () => cancelAnimation(press);
  }, [reducedMotion, press]);
  const surfaceStyle = useAnimatedStyle(() => ({
    opacity: selection.value,
    transform: [{ scale: reducedMotion ? 1 : 0.84 + selection.value * 0.16 }],
  }));
  const pressStyle = useAnimatedStyle(() => ({ opacity: press.value * 0.14 }));
  const contentStyle = useAnimatedStyle(() => ({
    transform: [{ scale: reducedMotion ? 1 : 1 - press.value * 0.08 }],
  }));
  const setPressed = (value: number) => {
    press.value = reducedMotion ? value : withTiming(value, {
      duration: value ? 90 : 180,
      easing: Easing.out(Easing.cubic),
    });
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected }} onPress={onPress}
    onPressIn={() => setPressed(1)} onPressOut={() => setPressed(0)} style={styles.button}>
    <Animated.View pointerEvents="none" style={[styles.actionContent, contentStyle]}>
      <Animated.View style={[styles.iconHighlight, { backgroundColor: resident.accentSoft, borderColor: resident.onAccent }, surfaceStyle]} />
      <Animated.View style={[styles.pressHighlight, { backgroundColor: selected ? resident.accentText : resident.onAccent }, pressStyle]} />
      {children}
    </Animated.View>
  </Pressable>;
}
const styles = StyleSheet.create({
  row: { minHeight: 56, paddingVertical: 6, marginLeft: 16, marginRight: 8, justifyContent: 'center' },
  normal: { minHeight: 44, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 36, height: 36, borderRadius: 18, marginRight: 12, flexShrink: 0 },
  title: { fontSize: 22, lineHeight: 28, flex: 1, minWidth: 0 },
  longTitle: { fontSize: 19, lineHeight: 22 },
  button: { width: 44, height: 44, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  actionContent: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  iconHighlight: { position: 'absolute', inset: 0, borderRadius: 24, borderWidth: 1 },
  pressHighlight: { position: 'absolute', inset: 0, borderRadius: 24 },
  searchLayer: { position: 'absolute', left: -12, right: 4, top: 6, height: 44 },
  field: { position: 'absolute', top: 0, height: 44, borderRadius: 24, paddingLeft: 14, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  fieldSurface: { position: 'absolute', left: 0, right: 0, top: 2, bottom: 2, borderRadius: 24 },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 8, fontSize: 15, height: 44 },
  clear: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  submit: { minWidth: 44, height: 44, paddingHorizontal: 10, justifyContent: 'center', alignItems: 'center' },
});
