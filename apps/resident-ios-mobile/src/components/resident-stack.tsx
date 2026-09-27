import { Stack } from 'expo-router/stack';
import { Link } from 'expo-router';
export function ResidentStack({ title }: { title: string }) {
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerRight: () => <Link href="/settings" accessibilityLabel="Open settings" style={{ padding: 12, fontSize: 17, color: '#0F6E5B' }}>Settings</Link> }}><Stack.Screen name="index" options={{ title, headerLargeTitleEnabled: true }} /></Stack>;
}
