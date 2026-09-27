import { NativeTabs } from 'expo-router/unstable-native-tabs';
export default function TabsLayout() {
  return <NativeTabs tintColor="#0F6E5B">
    <NativeTabs.Trigger name="home"><NativeTabs.Trigger.Icon sf="house" /><NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="services"><NativeTabs.Trigger.Icon sf="doc.text" /><NativeTabs.Trigger.Label>Services</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="maps"><NativeTabs.Trigger.Icon sf="map" /><NativeTabs.Trigger.Label>Maps</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="health"><NativeTabs.Trigger.Icon sf="heart" /><NativeTabs.Trigger.Label>Health</NativeTabs.Trigger.Label></NativeTabs.Trigger>
    <NativeTabs.Trigger name="reports"><NativeTabs.Trigger.Icon sf="megaphone" /><NativeTabs.Trigger.Label>Reports</NativeTabs.Trigger.Label></NativeTabs.Trigger>
  </NativeTabs>;
}
