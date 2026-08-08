import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { useTheme } from '@/hooks/use-theme';

// 6-tab bottom bar confirmed against the design file (see the plan's Design Reference
// Review) — Home, Services, Maps, Health, Reports, Settings. "Maps" is the Emergency &
// DRRM Info section under a shorter tab label; "Reports" is the Incident Reporting
// section (titled "Reports and Announcements" — Announcements lives as a sub-tab there,
// not its own bottom-tab item).
export default function AppTabs() {
  // useTheme() resolves the app's own theme preference (Settings > App Theme), not just
  // the OS scheme — so the tab bar's colors, and the active tab's accent-colored icon/
  // label, stay in sync with the rest of the app instead of only following the device.
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      indicatorColor={theme.backgroundSelected}
      iconColor={{ default: theme.textSecondary, selected: theme.primary }}
      labelStyle={{ default: { color: theme.textSecondary }, selected: { color: theme.primary } }}>
      <NativeTabs.Trigger name="home">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="house" md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="services">
        <NativeTabs.Trigger.Label>Services</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.clipboard" md="fact_check" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="maps">
        <NativeTabs.Trigger.Label>Maps</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="mappin.and.ellipse" md="location_on" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="health">
        <NativeTabs.Trigger.Label>Health</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="heart" md="favorite_border" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="reports">
        <NativeTabs.Trigger.Label>Reports</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="bell" md="notifications_none" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="gearshape" md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
