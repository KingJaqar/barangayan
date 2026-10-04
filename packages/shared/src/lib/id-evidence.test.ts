import { describe, expect, it } from 'vitest';
import { AccountRequestScope } from './id-evidence';

describe('account reply isolation', () => {
  it('rejects an earlier account response and foreign cached rows', () => {
    const scope = new AccountRequestScope();
    const a = scope.begin('A');
    const b = scope.begin('B');
    expect(scope.accepts(a, 'A')).toBe(false);
    expect(scope.accepts(b, 'A')).toBe(false);
    expect(scope.accepts(b, 'B')).toBe(true);
  });
  it('rejects pending responses after logout or a newer refresh', () => {
    const scope = new AccountRequestScope();
    const first = scope.begin('A');
    const next = scope.begin('A');
    expect(scope.accepts(first, 'A')).toBe(false);
    expect(scope.accepts(next, 'A')).toBe(true);
    scope.clear();
    expect(scope.accepts(next, 'A')).toBe(false);
    const relogin = scope.begin('A');
    expect(scope.accepts(next, 'A')).toBe(false);
    expect(scope.accepts(relogin, 'A')).toBe(true);
  });
});
