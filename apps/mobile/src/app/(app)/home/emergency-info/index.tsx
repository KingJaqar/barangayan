import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type EmergencyInfoTab = 'hub' | 'centers' | 'scan' | 'family' | 'alerts';

const TABS: { key: EmergencyInfoTab; label: string }[] = [
  { key: 'hub', label: 'Hub' },
  { key: 'centers', label: 'Centers' },
  { key: 'scan', label: 'Scan' },
  { key: 'family', label: 'Family' },
  { key: 'alerts', label: 'Alerts' },
];

// Emergency & DRRM Info, reached from Home's "Emergency Info" quick action via
// router.push. This route lives inside Home's own nested stack ((app)/home/_layout.tsx)
// rather than as a flat (app)-level sibling: unstable-native-tabs' NativeTabs only routes
// to screens declared as a NativeTabs.Trigger, so a route outside any tab's subtree is
// simply unreachable — nesting it under Home is what keeps the bottom nav on "Home".
// Sub-nav is a plain underline tab bar, not the SegmentedControl pill used elsewhere, per
// the reworked design. "Scan" is an action (Guide-before-camera flow), not an inline
// panel, so it pushes a screen instead of changing the active tab.
export default function EmergencyInfoScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<EmergencyInfoTab>('hub');

  function handleChange(next: EmergencyInfoTab) {
    if (next === 'scan') {
      router.push('/home/emergency-info/qr-guide');
      return;
    }
    setTab(next);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.topHeader, { backgroundColor: theme.primary, paddingTop: insets.top + Spacing.two }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back to Home"
          hitSlop={Spacing.one}
          onPress={() => router.back()}
          style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color={theme.onPrimary} />
        </Pressable>
        <View style={styles.headerContent}>
          <ThemedText type="smallBold" style={[styles.headerTitle, { color: theme.onPrimary }]}>
            Emergency & DRRM Info
          </ThemedText>
        </View>
      </View>

      <ThemedView style={styles.tabBar}>
        {TABS.map((option) => {
          const isActive = option.key === tab;
          return (
            <Pressable
              key={option.key}
              onPress={() => handleChange(option.key)}
              style={styles.tabPressable}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}>
              <View style={[styles.tabItem, isActive && { borderBottomColor: theme.primary }]}>
                <ThemedText
                  type={isActive ? 'smallBold' : 'small'}
                  themeColor={isActive ? undefined : 'textSecondary'}
                  style={isActive ? { color: theme.primary } : undefined}>
                  {option.label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </ThemedView>

      {tab === 'hub' && <PlaceholderPanel label="Emergency & DRRM hub goes here." />}
      {tab === 'centers' && <PlaceholderPanel label="Evacuation centers (List/Map toggle) go here." />}
      {tab === 'family' && <PlaceholderPanel label="Household & family QR check-in go here." />}
      {tab === 'alerts' && <PlaceholderPanel label="Emergency alerts/notices go here." />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  topHeader: {
    paddingBottom: Spacing.three,
    alignItems: 'center',
    position: 'relative',
  },
  headerContent: {
    height: 40,
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.two,
    bottom: Spacing.one,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.three,
  },
  tabPressable: {
    flex: 1,
  },
  tabItem: {
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
});
