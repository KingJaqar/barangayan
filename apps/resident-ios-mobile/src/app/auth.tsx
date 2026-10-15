import { Redirect } from 'expo-router';

/** Source-compatible alias for the account-choice entry. */
export default function AuthAlias() { return <Redirect href="/auth/choice" />; }
