import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Keyboard, Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationBell } from '@/components/notification-bell';
import { ThemedText } from '@/components/themed-text';
import { useSearchDraft } from '@/hooks/use-resident-search';
import { useTheme } from '@/hooks/use-theme';

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
  const searching = pathname === '/search';
  const title = TITLES[pathname];
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { query, setQuery, rememberSearch } = useSearchDraft();
  const input = useRef<TextInput>(null);
  const [width, setWidth] = useState(336);
  const [searchX, setSearchX] = useState(140);
  const progress = useSharedValue(searching ? 1 : 0);
  useEffect(() => {
    progress.value = withTiming(searching ? 1 : 0, { duration: 200 });
    if (!searching) {
      input.current?.blur();
      return;
    }
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [searching, progress]);
  const fieldStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    left: searchX + (48 - searchX) * progress.value,
    width: 44 + (width - 48 - 44) * progress.value,
  }));
  const normalStyle = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const closeSearch = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace('/home');
  };
  return <View style={{
    display: title || searching ? 'flex' : 'none',
    backgroundColor: theme.primary,
    paddingTop: insets.top,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  }}>
    <View style={styles.row} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View
        style={[styles.normal, normalStyle]}
        pointerEvents={searching ? 'none' : 'auto'}
        accessibilityElementsHidden={searching}
        importantForAccessibility={searching ? 'no-hide-descendants' : 'auto'}>
        <Image source={require('@/assets/logo/barangayan-logo-1024.png')}
          style={styles.logo} contentFit="contain" accessibilityLabel="Barangayan" />
        <ThemedText accessibilityRole="header"
          style={[styles.title, { color: theme.onPrimary }]}>{title}</ThemedText>
        <View onLayout={event => setSearchX(event.nativeEvent.layout.x)}>
          <Pressable accessibilityRole="button" accessibilityLabel="Search"
            onPress={() => router.navigate('/search')} style={styles.button}>
            <Ionicons name="search" size={24} color={theme.onPrimary} />
          </Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="View announcements"
          onPress={() => router.navigate('/announcements')} style={styles.button}>
          <NotificationBell color={theme.onPrimary} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Open settings"
          onPress={() => router.navigate('/settings')} style={styles.button}>
          <Ionicons name="menu" size={26} color={theme.onPrimary} />
        </Pressable>
      </Animated.View>
      <View style={styles.searchLayer} pointerEvents={searching ? 'box-none' : 'none'}
        accessibilityElementsHidden={!searching}
        importantForAccessibility={searching ? 'auto' : 'no-hide-descendants'}>
        {searching ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back from search"
            onPress={closeSearch} style={styles.button}>
            <Ionicons name="arrow-back" size={24} color={theme.onPrimary} />
          </Pressable>
        ) : null}
        <Animated.View style={[styles.field, { backgroundColor: theme.backgroundElement }, fieldStyle]}>
          <Ionicons name="search" size={20} color={theme.textSecondary} />
          <TextInput
            ref={input} value={query} onChangeText={setQuery} maxLength={120} editable={searching}
            accessibilityLabel="Search services, announcements and your records"
            placeholder="Search Barangayan" placeholderTextColor={theme.textSecondary}
            returnKeyType="search" autoCorrect={false}
            onSubmitEditing={() => { rememberSearch(query); Keyboard.dismiss(); }} style={[styles.input, { color: theme.text }]} />
          {query ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Clear search"
              onPress={() => { setQuery(''); input.current?.focus(); }} style={styles.clear}>
              <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
            </Pressable>
          ) : null}
        </Animated.View>
      </View>
    </View>
  </View>;
}
const styles = StyleSheet.create({
  row: { minHeight: 64, paddingVertical: 8, marginHorizontal: 12, justifyContent: 'center' },
  normal: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 2 },
  logo: { width: 32, height: 32, borderRadius: 16, marginRight: 6, flexShrink: 0 },
  title: { fontSize: 18, lineHeight: 24, flex: 1, minWidth: 0 },
  button: { width: 44, height: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  searchLayer: { position: 'absolute', left: 0, right: 0, top: 8, height: 48 },
  field: { position: 'absolute', top: 0, height: 48, borderRadius: 24, paddingLeft: 12, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  input: { flex: 1, minWidth: 0, paddingHorizontal: 8, fontSize: 16, height: 48 },
  clear: { width: 44, height: 48, justifyContent: 'center', alignItems: 'center' },
});
