import { describe, expect, it, vi } from 'vitest';
import { createHash, randomFillSync, webcrypto } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { installPKCECrypto } from './pkce-crypto';
describe('native PKCE primitives', () => {
  it('preserves existing complete WebCrypto', () => {
    const target = { crypto: webcrypto as unknown as Crypto }, random = vi.fn(), digest = vi.fn();
    installPKCECrypto(target,random,digest);
    expect(target.crypto).toBe(webcrypto); expect(target.crypto.subtle).toBe(webcrypto.subtle);
  });
  it('adds missing secure entropy/digest and produces an actual SDK S256 authorize URL', async () => {
    const original = Object.getOwnPropertyDescriptor(globalThis,'crypto');
    const target: { crypto?: Crypto } = {};
    const random = vi.fn(<T extends ArrayBufferView | null>(array: T): T => { if(array) randomFillSync(new Uint8Array(array.buffer,array.byteOffset,array.byteLength)); return array; });
    installPKCECrypto(target,random,webcrypto.subtle.digest.bind(webcrypto.subtle) as SubtleCrypto['digest']);
    Object.defineProperty(globalThis,'crypto',{value:target.crypto,configurable:true});
    const warnings=vi.spyOn(console,'warn').mockImplementation(()=>{});
    const values=new Map<string,string>();
    try {
      const client=createClient('http://127.0.0.1:54321','local-public-test-key',{auth:{flowType:'pkce',autoRefreshToken:false,persistSession:true,detectSessionInUrl:false,storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}}}});
      const {data,error}=await client.auth.signInWithOAuth({provider:'google',options:{skipBrowserRedirect:true,redirectTo:'barangayan://auth/callback'}});
      expect(error).toBe(null); const url=new URL(data.url!);
      expect(url.searchParams.get('code_challenge_method')).toBe('s256');
      const verifier=[...values.entries()].find(([key])=>key.includes('code-verifier'))?.[1];
      expect(verifier).toBeTruthy();
      // PKCE storage may add the flow ID/recovery suffix; compare the actual
      // verifier string used by this SDK, held only in this test's memory.
      const raw=(JSON.parse(verifier!) as string).replace(/\/PASSWORD_RECOVERY$/,'');
      expect(url.searchParams.get('code_challenge')).toBe(createHash('sha256').update(raw).digest('base64url'));
      expect(random).toHaveBeenCalled(); expect(warnings).not.toHaveBeenCalled();
    } finally { warnings.mockRestore(); if(original) Object.defineProperty(globalThis,'crypto',original); else Reflect.deleteProperty(globalThis,'crypto'); }
  });
});
