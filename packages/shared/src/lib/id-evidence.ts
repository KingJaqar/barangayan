import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import { serviceFoundationOperations } from './service-foundations';

/** Copies both selected sides into a new immutable submission. The stable ID
 * makes interrupted upload/publication retries safe, including type-only changes. */
export async function publishIdEvidence(client: SupabaseClient<Database>, input: {
  submissionId: string; idType: string; frontPath: string; backPath: string;
}) {
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) throw new Error('Sign in again before submitting your ID.');
  const bucket = client.storage.from('id-documents');
  async function copySide(source: string, side: 'front' | 'back') {
    if (!source.startsWith(`${user!.id}/`)) throw new Error('Invalid ID evidence owner.');
    const extension = source.split('.').pop()?.toLowerCase();
    if (!extension || !['jpg', 'jpeg', 'png', 'webp'].includes(extension)) throw new Error('Unsupported ID image.');
    const target = `${user!.id}/versions/${input.submissionId}/id-${side}.${extension}`;
    if (source === target) return target;
    const { data, error } = await bucket.download(source);
    if (error || !data) throw new Error('Could not read your ID image. Select it again and retry.');
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('ID images must be at most 5 MB.');
    const mime = extension === 'png' ? 'image/png' : extension === 'webp' ? 'image/webp' : 'image/jpeg';
    const { error: uploadError } = await bucket.upload(target, bytes, { upsert: false, contentType: mime });
    if (uploadError) {
      // A lost upload response may leave the target present. Accept only identical
      // bytes; never overwrite the immutable target to recover from a conflict.
      const { data: existing } = await bucket.download(target);
      const saved = existing ? new Uint8Array(await existing.arrayBuffer()) : null;
      if (!saved || saved.length !== bytes.length || saved.some((byte, index) => byte !== bytes[index])) throw uploadError;
    }
    return target;
  }
  const frontPath = await copySide(input.frontPath, 'front');
  const backPath = await copySide(input.backPath, 'back');
  const { data, error } = await serviceFoundationOperations(client).publishId({ ...input, frontPath, backPath });
  if (error) throw error;
  return { submissionId: data, frontPath, backPath };
}

/** Generations reject replies begun before account changes or newer refreshes. */
export class AccountRequestScope {
  private generation = 0;
  private owner: string | null = null;
  setOwner(owner: string | null) {
    if (this.owner !== owner) { this.owner = owner; this.generation++; }
  }
  begin(owner: string) { this.setOwner(owner); return { owner, generation: ++this.generation }; }
  accepts(ticket: { owner: string; generation: number }, rowOwner: string) {
    return this.owner === rowOwner && ticket.owner === rowOwner && ticket.generation === this.generation;
  }
  clear() { this.owner = null; this.generation++; }
}
