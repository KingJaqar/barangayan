import { describe, expect, it } from 'vitest';
import { removeOwnedStorageObjects } from './storage-cleanup';

const owner = 'b1000000-0000-4000-8000-000000000001';
function fixture(paths: string[]) {
  const objects = new Set(paths);
  const listed: string[] = [];
  const batches: string[][] = [];
  const bucket = {
    async list(prefix: string, options: { limit: number; offset: number }) {
      listed.push(prefix);
      const entries = new Map<string, {name: string; id: string | null}>();
      for (const path of objects) {
        if (!path.startsWith(prefix + '/')) continue;
        const relative = path.slice(prefix.length + 1);
        const slash = relative.indexOf('/');
        const name = slash < 0 ? relative : relative.slice(0, slash);
        entries.set(name, { name, id: slash < 0 ? path : null });
      }
      return {data: [...entries.values()].sort((a,b)=>a.name.localeCompare(b.name)).slice(options.offset, options.offset + options.limit), error: null};
    },
    async remove(paths: string[]) {
      batches.push(paths);
      for (const path of paths) objects.delete(path);
      return {error: null};
    },
  };
  return {bucket,objects,listed,batches};
}

describe('account-deletion storage compatibility', () => {
  it('deletes legacy files, nested ID versions and unattached requirement objects only for the caller', async () => {
    const other = 'b1000000-0000-4000-8000-000000000002';
    const f = fixture([`${owner}/avatar.png`, `${owner}/versions/v1/id-front.png`, `${owner}/versions/v1/id-back.png`, `${owner}/request-id/nested/requirement.pdf`, `${other}/versions/v1/id-front.png`]);
    await removeOwnedStorageObjects(f.bucket, owner);
    expect([...f.objects]).toEqual([`${other}/versions/v1/id-front.png`]);
    expect(f.listed.every(prefix=>prefix===owner || prefix.startsWith(owner+'/'))).toBe(true);
    expect(f.batches.flat().every(path=>path.startsWith(owner+'/'))).toBe(true);
  });
  it('collects every page before removal, including nested pages and exactly full pages', async () => {
    const own = [...Array.from({length:200},(_,i)=>`${owner}/file-${i.toString().padStart(3,'0')}.png`), ...Array.from({length:150},(_,i)=>`${owner}/versions/version-${i}/id-front.png`)];
    const f = fixture(own);
    await removeOwnedStorageObjects(f.bucket, owner);
    expect(f.objects.size).toBe(0);
    expect(new Set(f.batches.flat()).size).toBe(350);
    expect(f.batches.every(batch=>batch.length<=100)).toBe(true);
  });
  it('allows retries after objects were already removed', async () => {
    const f = fixture([`${owner}/versions/v1/id-front.png`]);
    await removeOwnedStorageObjects(f.bucket, owner);
    await removeOwnedStorageObjects(f.bucket, owner);
    expect(f.batches).toHaveLength(1);
  });
  it('rejects traversal or another-owner prefixes before calling privileged storage', async () => {
    const f = fixture([]);
    await expect(removeOwnedStorageObjects(f.bucket, owner+'/../other')).rejects.toThrow('Invalid storage owner');
    expect(f.listed).toHaveLength(0);
  });
  it.each(['..', '.', '../other/file.png', 'nested/file.png', 'nested\\file.png'])('rejects unsafe listed entry %s', async name => {
    const f = fixture([]);
    const bucket = {...f.bucket, list: async ()=>({data:[{name,id:'file'}],error:null})};
    await expect(removeOwnedStorageObjects(bucket,owner)).rejects.toThrow('Invalid storage entry');
    expect(f.batches).toHaveLength(0);
  });
  it('surfaces a returned listing failure before removing any partial page', async () => {
    const f = fixture(Array.from({length:100},(_,i)=>`${owner}/${i}.png`));
    const bucket = {...f.bucket, list: async (prefix: string, options: {limit:number;offset:number})=>options.offset ? {data:null,error:new Error('network')} : f.bucket.list(prefix,options)};
    await expect(removeOwnedStorageObjects(bucket,owner)).rejects.toThrow('Storage listing failed');
    expect(f.objects.size).toBe(100);
    expect(f.batches).toHaveLength(0);
  });
  it('surfaces removal failures for the handler to treat as best effort', async () => {
    const f = fixture([`${owner}/photo.png`]);
    await expect(removeOwnedStorageObjects({...f.bucket,remove:async()=>({error:new Error('network')})},owner)).rejects.toThrow('Storage removal failed');
    expect(f.objects.size).toBe(1);
  });
});
