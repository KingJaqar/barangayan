import { Redirect } from 'expo-router';
/** Earlier iOS links opened /profile; the profile now lives in the Settings destination stack. */
export default function LegacyProfileLink() { return <Redirect href="/settings/profile" />; }
