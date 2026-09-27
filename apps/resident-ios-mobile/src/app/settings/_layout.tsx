import { Stack } from 'expo-router/stack';

export default function SettingsLayout() {
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal' }}><Stack.Screen name="index" options={{ title: 'Settings' }} /><Stack.Screen name="change-password" options={{ title: 'Change password' }} /><Stack.Screen name="help/index" options={{ title: 'Help' }} /><Stack.Screen name="help/[id]" options={{ title: 'Help article' }} /><Stack.Screen name="information" options={{ title: 'Resident information' }} /></Stack>;
}
