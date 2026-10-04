type StorageItem = { name: string; id: string | null };
type OwnedBucket = {
  list(prefix: string, options: { limit: number; offset: number; sortBy: { column: string; order: 'asc' } }): Promise<{ data: StorageItem[] | null; error: unknown }>;
  remove(paths: string[]): Promise<{ error: unknown }>;
};

/** Collect before deleting so pagination cannot skip objects as earlier pages disappear. */
export async function removeOwnedStorageObjects(bucket: OwnedBucket, userId: string): Promise<void> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    throw new Error('Invalid storage owner');
  }
  const prefixes = [userId];
  const files: string[] = [];
  const pageSize = 100;
  while (prefixes.length) {
    const prefix = prefixes.pop()!;
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await bucket.list(prefix, { limit: pageSize, offset, sortBy: { column: 'name', order: 'asc' } });
      if (error || !data) throw new Error('Storage listing failed');
      for (const item of data) {
        if (!item.name || item.name === '.' || item.name === '..' || /[/\\]/.test(item.name)) {
          throw new Error('Invalid storage entry');
        }
        const objectPath = `${prefix}/${item.name}`;
        if (item.id === null) prefixes.push(objectPath);
        else files.push(objectPath);
      }
      if (data.length < pageSize) break;
    }
  }
  for (let offset = 0; offset < files.length; offset += pageSize) {
    const { error } = await bucket.remove(files.slice(offset, offset + pageSize));
    if (error) throw new Error('Storage removal failed');
  }
}
