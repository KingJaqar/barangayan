export type SettingsRecoveryOwner = { userId: string; email: string; sessionId: string };
export type SettingsRecoveryFailure = {
  ok: false;
  kind: 'session' | 'unverified' | 'mismatch' | 'connection' | 'rate-limit' | 'service' | 'rejected';
  message: string;
  href?: string;
};
export type SettingsRecoveryResult = { ok: true } | SettingsRecoveryFailure;

export function maskRecoveryEmail(email: string) {
  const [name, domain] = email.split('@');
  return domain ? `${name.slice(0, 2)}••••@${domain}` : 'your verified email';
}
