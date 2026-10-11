import { describe, expect, it, vi } from 'vitest';
import { GoogleAuthFlow, parseGoogleAttempt, type GoogleAttempt } from './google-auth-flow';
import { SetupRequestGate } from './setup-request';
function fixture(intent: GoogleAttempt['intent'] = 'sign_up') {
  let attempt: GoogleAttempt = { id: 'attempt-1', started: Date.now(), intent, purpose: intent === 'reauthenticate' ? 'set_password' : null, phase: 'issued', expectedUserId: intent === 'link' || intent === 'reauthenticate' ? 'a' : null, userId: null };
  let current: { id: string; google: boolean; lastSignIn: number } | null = attempt.expectedUserId ? { id: 'a', google: false, lastSignIn: 0 } : null;
  const exchange = vi.fn(async () => { current = { id: 'a', google: true, lastSignIn: Date.now() }; return 'a'; });
  const provision = vi.fn(async () => {});
  const discardUnexpectedSession = vi.fn(async (uid: string) => { if (current?.id === uid) current = null; });
  const deps = { read: async () => JSON.stringify(attempt), write: async (v: GoogleAttempt) => { attempt = v; }, current: async () => current, exchange, discardUnexpectedSession, provision, gate: new SetupRequestGate() };
  return { flow: new GoogleAuthFlow(deps), deps, exchange, provision, get attempt() { return attempt; }, setAttempt: (v: GoogleAttempt) => { attempt = v; }, setCurrent: (v: typeof current) => { current = v; } };
}
const callback = 'barangayan://auth/callback?code=test-only';
describe('Android Google callback lifecycle', () => {
  it.each(['sign_in','sign_up','link','reauthenticate'] as const)('retains %s purpose and owner, then deduplicates browser/warm callbacks', async intent => {
    const f = fixture(intent); const [a,b] = await Promise.all([f.flow.finish(callback),f.flow.finish(callback)]);
    expect(a.intent).toBe(intent); expect(b.userId).toBe('a'); expect(f.exchange).toHaveBeenCalledTimes(1); expect(f.provision).toHaveBeenCalledTimes(1);
    await f.flow.finish(callback); expect(f.exchange).toHaveBeenCalledTimes(1); expect(f.provision).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(f.attempt)).not.toContain('test-only');
  });
  it('retries failed provisioning across restart without exchanging the consumed code', async () => {
    const f=fixture(); f.provision.mockRejectedValueOnce(new Error('offline'));
    await expect(f.flow.finish(callback)).rejects.toThrow('offline'); expect(f.attempt.phase).toBe('consumed');
    const cold = new GoogleAuthFlow(f.deps); await cold.finish(); expect(f.exchange).toHaveBeenCalledTimes(1); expect(f.provision).toHaveBeenCalledTimes(2);
  });
  it('reconciles crash between exchange and checkpoint using fresh Auth-owned sign-in evidence', async () => {
    const f=fixture(); f.setAttempt({...f.attempt, phase:'exchanging'}); f.setCurrent({id:'a',google:true,lastSignIn:Date.now()});
    await new GoogleAuthFlow(f.deps).finish(callback); expect(f.exchange).not.toHaveBeenCalled();
  });
  it('never treats an old Google session as a fresh consumed exchange', async () => {
    const f=fixture(); f.setAttempt({...f.attempt, phase:'exchanging'}); f.setCurrent({id:'old',google:true,lastSignIn:0});
    await expect(f.flow.finish()).rejects.toThrow('No verified'); expect(f.provision).not.toHaveBeenCalled();
  });
  it('rejects a second callback while a different code is in progress', async () => {
    const f=fixture(); const a=f.flow.finish(callback);
    await expect(f.flow.finish('barangayan://auth/callback?code=other')).rejects.toThrow('different'); await a;
    await expect(f.flow.finish('barangayan://auth/callback?code=other')).rejects.toThrow('different');
  });
  it.each(['https://evil.test/?code=test','barangayan://wrong/callback?code=test','barangayan://auth/callback?code=x&code=y','barangayan://auth/callback?error=denied'])('rejects malformed/cancelled callback %s before exchange', async url => {
    const f=fixture(); expect(() => f.flow.finish(url)).toThrow(); expect(f.exchange).not.toHaveBeenCalled();
  });
  it('rejects absent/expired attempts and consumed attempts owned by another session', async () => {
    const f=fixture(); f.setAttempt({...f.attempt,started:Date.now()-600001}); await expect(f.flow.finish(callback)).rejects.toThrow('expired');
    f.setAttempt({...f.attempt,started:Date.now(),phase:'consumed',userId:'a'}); f.setCurrent({id:'b',google:true,lastSignIn:Date.now()});
    await expect(f.flow.finish()).rejects.toThrow('another session'); expect(f.exchange).not.toHaveBeenCalled();
  });
  it('rejects linking/reauthentication after an account switch without mutation', async () => {
    const f=fixture('link'); f.setCurrent({id:'b',google:true,lastSignIn:Date.now()});
    await expect(f.flow.finish(callback)).rejects.toThrow('account changed'); expect(f.exchange).not.toHaveBeenCalled(); expect(f.provision).not.toHaveBeenCalled();
    expect(f.deps.discardUnexpectedSession).not.toHaveBeenCalled();
  });
  it.each(['link', 'reauthenticate'] as const)('clears a wrong account installed by %s exchange before provisioning', async intent => {
    const f = fixture(intent);
    f.exchange.mockImplementationOnce(async () => { f.setCurrent({ id: 'b', google: true, lastSignIn: Date.now() }); return 'b'; });
    await expect(f.flow.finish(callback)).rejects.toThrow('different Google account');
    expect(f.deps.discardUnexpectedSession).toHaveBeenCalledExactlyOnceWith('b');
    expect(await f.deps.current()).toBeNull(); expect(f.provision).not.toHaveBeenCalled();
    expect(f.attempt.phase).toBe('exchanging');
  });
  it('surfaces failed unintended-session cleanup without completing or provisioning', async () => {
    const f = fixture('reauthenticate');
    f.exchange.mockImplementationOnce(async () => { f.setCurrent({ id: 'b', google: true, lastSignIn: Date.now() }); return 'b'; });
    f.deps.discardUnexpectedSession.mockRejectedValueOnce(new Error('Sign out and authenticate again'));
    await expect(f.flow.finish(callback)).rejects.toThrow('Sign out');
    expect(f.provision).not.toHaveBeenCalled(); expect(f.attempt.userId).toBeNull();
  });
  it('rejects and clears the exchanged wrong account before a second network read', async () => {
    const f = fixture('reauthenticate');
    const reads = vi.spyOn(f.deps, 'current').mockResolvedValueOnce({ id: 'a', google: true, lastSignIn: 0 }).mockRejectedValueOnce(new Error('Offline user lookup'));
    f.exchange.mockImplementationOnce(async () => { f.setCurrent({ id: 'b', google: true, lastSignIn: Date.now() }); return 'b'; });
    await expect(f.flow.finish(callback)).rejects.toThrow('different Google account');
    expect(reads).toHaveBeenCalledTimes(1); expect(f.deps.discardUnexpectedSession).toHaveBeenCalledExactlyOnceWith('b');
    expect(f.provision).not.toHaveBeenCalled();
  });
  it('ignores a provisioning result after account/attempt switch', async () => {
    const f=fixture(); f.provision.mockImplementationOnce(async () => { f.setCurrent({id:'b',google:true,lastSignIn:Date.now()}); });
    await expect(f.flow.finish(callback)).rejects.toThrow('account or sign-in attempt changed'); expect(f.attempt.phase).toBe('consumed');
  });
  it('validates the minimal persisted intent schema', () => {
    for (const value of [null,'{',JSON.stringify({id:'x'}),JSON.stringify({...fixture().attempt,started:Date.now()+1000}),JSON.stringify({...fixture().attempt,intent:'evil'})]) expect(parseGoogleAttempt(value)).toBe(null);
  });
});
