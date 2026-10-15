import { Redirect } from 'expo-router';

/** Source-compatible alias: a new password is only accepted after a verified code, inside recovery. */
export default function ResetPasswordAlias() { return <Redirect href="/auth/recovery" />; }
