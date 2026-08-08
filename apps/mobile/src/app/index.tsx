import { Redirect } from 'expo-router';

// Stub for the app's bare root path ("/"). Expo Router/Linking treats "/" as the app's
// default launch URL — a fresh cold start (or a dev-client reload with no deep link)
// resolves to it directly, independent of any in-app navigation. Home used to be exactly
// that route (a flat (app)/index.tsx), so "/" always resolved. It was moved to
// (app)/home/index.tsx (path "/home") so Emergency Info could be pushed onto Home's own
// nested stack while keeping the bottom nav on "Home" — see (app)/home/_layout.tsx.
// That left "/" itself with no matching screen ("Unmatched Route"), so this file exists
// purely to forward it into the real Home route. Stack.Protected in the root layout
// still governs whether (app) or (auth) is actually reachable; this only supplies the
// missing target for "/" and lets that existing guard/redirect logic take over from there.
//
// Named "index" deliberately, and Home's own directory is named "home" (not "index") —
// reusing "index" for both this root stub AND the nested Home route caused a route-name
// collision: router.replace('/index') was resolving back to THIS stub instead of Home's
// screen, producing an infinite self-redirect that surfaced as "Unmatched Route" right
// after login/guest-mode. Keep these two names distinct.
export default function RootIndexRedirect() {
  return <Redirect href="/home" />;
}
