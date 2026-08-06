import { useRouter } from 'expo-router';
import { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { PlaceholderPanel } from '@/components/placeholder-panel';
import { SegmentedControl } from '@/components/segmented-control';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';

type MapsSegment = 'hub' | 'centers' | 'scan' | 'family' | 'alerts';

// Emergency & DRRM Info, tab-labeled "Maps". Sub-nav confirmed against the design file:
// Hub / Centers / Scan / Family / Alerts. "Scan" is an action (Guide-before-camera flow),
// not an inline panel, so it pushes a screen instead of changing the active segment —
// see AGENTS.md §4's locked structural decisions.
export default function MapsScreen() {
  const router = useRouter();
  const [segment, setSegment] = useState<MapsSegment>('hub');

  function handleChange(next: MapsSegment) {
    if (next === 'scan') {
      router.push('/maps/qr-guide');
      return;
    }
    setSegment(next);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ThemedView style={styles.header}>
        <SegmentedControl
          segments={[
            { key: 'hub', label: 'Hub' },
            { key: 'centers', label: 'Centers' },
            { key: 'scan', label: 'Scan' },
            { key: 'family', label: 'Family' },
            { key: 'alerts', label: 'Alerts' },
          ]}
          activeKey={segment}
          onChange={handleChange}
          activeColor="accentRed"
        />
      </ThemedView>

      {segment === 'hub' && <PlaceholderPanel label="Emergency & DRRM hub goes here." />}
      {segment === 'centers' && (
        <PlaceholderPanel label="Evacuation centers (List/Map toggle) go here." />
      )}
      {segment === 'family' && <PlaceholderPanel label="Household & family QR check-in go here." />}
      {segment === 'alerts' && <PlaceholderPanel label="Emergency alerts/notices go here." />}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    padding: Spacing.three,
  },
});
