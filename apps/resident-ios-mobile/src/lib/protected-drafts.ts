import { z, type ZodType } from 'zod';
import { DataError } from '../data/outcome';
import { scopeKey, type DataScope } from '../data/scope';
import type { KeyValueStore } from './secure-storage-core';

/**
 * Protected persistence for recoverable private state — unsent form drafts and staged
 * upload references (plan §3, P02-T04, handoff "Form and upload behavior").
 *
 * - Values live only in the Keychain-backed store passed in; there is no plaintext
 *   fallback. A failed protected write is reported to the caller, never downgraded.
 * - Every entry is bound to environment + tenant + account + kind + schema version; a
 *   read from any other scope, or of an older schema, discards the entry.
 * - Keychain cannot list its keys, so an index (also in the Keychain) records every entry
 *   *before* it is written. Logout/account switch purge through the index, and an
 *   interrupted write can never leave an entry the purge does not know about.
 */
const indexEntry = z.object({ name: z.string(), owner: z.string() });
const INDEX = 'draft-index';
const envelope = z.object({ format: z.literal(1), owner: z.string(), kind: z.string(), schemaVersion: z.number().int(), savedAt: z.number(), value: z.unknown() });

function ownerOf(scope: DataScope): string {
  if (!scope.userId) throw new DataError('session', 'Sign in to save a private draft.');
  return scopeKey(scope);
}

export function createProtectedDrafts(secure: KeyValueStore, now: () => number = Date.now) {
  let tail: Promise<unknown> = Promise.resolve();
  const exclusive = <T>(operation: () => Promise<T>): Promise<T> => {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  };
  async function readIndex() {
    const raw = await secure.getItem(INDEX);
    if (!raw) return [];
    const parsed = z.array(indexEntry).safeParse(JSON.parse(raw));
    // A corrupt index cannot be trusted to find entries; fail closed so callers purge.
    if (!parsed.success) throw new DataError('schema', 'Saved drafts are unreadable.');
    return parsed.data;
  }
  const writeIndex = (entries: z.infer<typeof indexEntry>[]) => secure.setItem(INDEX, JSON.stringify(entries));
  const nameOf = (owner: string, kind: string) => `draft.${owner}.${kind.replace(/[^a-zA-Z0-9-]/g, '_')}`;

  async function removeEntries(keep: (entry: z.infer<typeof indexEntry>) => boolean) {
    const entries = await readIndex();
    const doomed = entries.filter((item) => !keep(item));
    if (!doomed.length) return;
    const failed: z.infer<typeof indexEntry>[] = [];
    for (const entry of doomed) {
      try { await secure.removeItem(entry.name); } catch { failed.push(entry); }
    }
    await writeIndex(entries.filter((item) => keep(item)).concat(failed));
    if (failed.length) throw new DataError('unknown', 'Some private drafts could not be removed. Retry cleanup.');
  }

  return {
    save: (scope: DataScope, kind: string, schemaVersion: number, value: unknown) => exclusive(async () => {
      const owner = ownerOf(scope);
      const name = nameOf(owner, kind);
      const entries = await readIndex();
      if (!entries.some((entry) => entry.name === name)) await writeIndex([...entries, { name, owner }]);
      await secure.setItem(name, JSON.stringify({ format: 1, owner, kind, schemaVersion, savedAt: now(), value }));
    }),
    read: <T>(scope: DataScope, kind: string, schemaVersion: number, schema: ZodType<T>) => exclusive(async (): Promise<{ value: T; savedAt: number } | null> => {
      const owner = ownerOf(scope);
      const name = nameOf(owner, kind);
      const raw = await secure.getItem(name);
      if (!raw) return null;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); } catch { parsed = null; }
      const entry = envelope.safeParse(parsed);
      const value = entry.success ? schema.safeParse(entry.data.value) : null;
      if (!entry.success || !value?.success || entry.data.owner !== owner || entry.data.kind !== kind || entry.data.schemaVersion !== schemaVersion) {
        await secure.removeItem(name);
        return null;
      }
      return { value: value.data, savedAt: entry.data.savedAt };
    }),
    remove: (scope: DataScope, kind: string) => exclusive(async () => {
      const name = nameOf(ownerOf(scope), kind);
      await secure.removeItem(name);
      await writeIndex((await readIndex()).filter((entry) => entry.name !== name));
    }),
    /** Logout / reinstall: removes every draft of every account. Throws if any removal failed. */
    purgeAll: () => exclusive(async () => {
      let entries: z.infer<typeof indexEntry>[] | null;
      try { entries = await readIndex(); } catch { entries = null; }
      // A corrupt index cannot list its entries. They stay owner-bound (never readable by
      // another account) and are replaced when that owner saves the same kind again.
      if (entries === null) { await secure.removeItem(INDEX); return; }
      await removeEntries(() => false);
    }),
    /** Account switch: drafts of any other account/tenant/environment are removed, not hidden. */
    purgeOthers: (scope: DataScope) => exclusive(async () => {
      const owner = ownerOf(scope);
      await removeEntries((entry) => entry.owner === owner);
    }),
  };
}
export type ProtectedDrafts = ReturnType<typeof createProtectedDrafts>;
