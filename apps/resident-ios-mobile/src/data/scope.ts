/**
 * Owner/tenant/environment/schema scope for anything kept beyond one render: caches,
 * drafts and staged-upload references (plan §3, P02-T02). Two scopes that differ in any
 * part never share data.
 */
export type DataScope = {
  environment: 'development' | 'staging' | 'production';
  barangayId: string;
  /** null for guest/public data. */
  userId: string | null;
};

export function scopeKey(scope: DataScope, ...parts: string[]): string {
  const owner = scope.userId ?? 'public';
  return [scope.environment, scope.barangayId, owner, ...parts].map((part) => part.replace(/[^a-zA-Z0-9-]/g, '_')).join('.');
}

