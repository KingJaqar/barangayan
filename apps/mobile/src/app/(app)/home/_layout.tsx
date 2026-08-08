import { Stack } from 'expo-router';

// Home gets its own nested stack — same pattern as maps/_layout.tsx — so that pushing
// into emergency-info stays inside the Home tab's subtree and the bottom nav keeps
// "Home" highlighted. NativeTabs (with unstable-native-tabs' useOnlyUserDefinedScreens)
// only routes to screens declared as a NativeTabs.Trigger, so emergency-info can't be a
// flat top-level sibling under (app) — it has to live under whichever tab pushes it.
//
// Deliberately named "home", not "index": a directory literally named "index" collapses
// its OWN inner "index.tsx" file but still occupies its own path segment ("/index", not
// "/") — and "index" is also the app's own root-redirect stub name (app/index.tsx, which
// forwards "/" here). Reusing "index" for both caused route-name collisions during
// navigation (router.replace('/index') resolving back to the root stub instead of this
// screen) that surfaced as "Unmatched Route" right after login/guest-mode. "home" avoids
// the collision entirely.
export default function HomeLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="emergency-info" options={{ headerShown: false }} />
    </Stack>
  );
}
