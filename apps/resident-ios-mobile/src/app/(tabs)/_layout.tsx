import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { ReportCountsProvider, useReportCounts } from '../../data/report-counts';
import { badgeText, reportsBadgeCount } from '../../data/report-signals';
import { useColors } from '../../lib/theme';

/** Six statically declared destinations. On iPhone, UIKit moves the fifth and later destinations into the system More list. */
export default function TabsLayout() {
  return <ReportCountsProvider><Destinations /></ReportCountsProvider>;
}

function Destinations() {
  const colors = useColors();
  const { counts } = useReportCounts();
  // The single system badge is unread resolved reports + unread announcements; active reports stay a separate labeled count in Reports.
  const reportsUnread = reportsBadgeCount(counts);
  return <NativeTabs tintColor={colors.primary}>
    <NativeTabs.Trigger name="home"><NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} /><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="services"><NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} /><NativeTabs.Trigger.Label>Services</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="maps"><NativeTabs.Trigger.Icon sf={{ default: 'map', selected: 'map.fill' }} /><NativeTabs.Trigger.Label>Maps</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="health"><NativeTabs.Trigger.Icon sf={{ default: 'heart', selected: 'heart.fill' }} /><NativeTabs.Trigger.Label>Health</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="reports">
      <NativeTabs.Trigger.Icon sf={{ default: 'megaphone', selected: 'megaphone.fill' }} /><NativeTabs.Trigger.Label>Reports</NativeTabs.Trigger.Label>
      <NativeTabs.Trigger.Badge hidden={reportsUnread === 0}>{badgeText(reportsUnread)}</NativeTabs.Trigger.Badge>
    </NativeTabs.Trigger>
    <NativeTabs.Trigger name="settings"><NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} /><NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
