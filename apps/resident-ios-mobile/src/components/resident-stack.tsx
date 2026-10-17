import { Link } from 'expo-router';
import { Stack } from 'expo-router/stack';
import { layout, useType, useColors } from '../lib/theme';

/** One destination's nested native stack. Child titles are declared here so every pushed screen has a real header. */
export function ResidentStack({ title, screens = {}, settingsShortcut = true }: { title: string; screens?: Record<string, string>; settingsShortcut?: boolean }) {
  const colors = useColors();
  return <Stack screenOptions={{ headerBackButtonDisplayMode: 'minimal', headerTintColor: colors.primary, contentStyle: { backgroundColor: colors.canvas } }}>
    <Stack.Screen name="index" options={{ title, headerLargeTitleEnabled: true, headerRight: settingsShortcut ? () => <SettingsShortcut /> : undefined }} />
    {Object.entries(screens).map(([name, screenTitle]) => <Stack.Screen key={name} name={name} options={{ title: screenTitle }} />)}
  </Stack>;
}
/** Supplemental toolbar link; Settings remains a full destination (possibly inside More). */
function SettingsShortcut() {
  const colors = useColors();
  const type = useType();
  return <Link href="/settings" accessibilityRole="link" accessibilityLabel="Open Settings" style={[type.body, { color: colors.primary, minHeight: layout.controlMin, paddingVertical: 10, paddingHorizontal: 4 }]}>Settings</Link>;
}
