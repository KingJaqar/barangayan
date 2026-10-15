import { Redirect } from 'expo-router';

/** Source-compatible alias for email registration. */
export default function RegisterAlias() { return <Redirect href="/auth/register" />; }
