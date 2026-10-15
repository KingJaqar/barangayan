import { Redirect } from 'expo-router';

/** Source-compatible alias for password recovery. */
export default function RecoveryAlias() { return <Redirect href="/auth/recovery" />; }
