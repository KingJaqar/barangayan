import { Redirect } from 'expo-router';

/** Source-compatible alias: the registration code step lives on the register screen. */
export default function OtpAlias() { return <Redirect href="/auth/register" />; }
