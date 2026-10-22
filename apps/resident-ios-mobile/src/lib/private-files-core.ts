// Pure helper behind lib/private-files.ts, kept free of native modules so it can be unit-tested.
type Removable = { delete(): void };
type Listing = { exists: boolean; list(): Removable[] };

/** Deletes every entry of a folder and returns how many could not be removed. A missing folder has nothing to remove. */
export function emptyListing(listing: Listing): number {
  if (!listing.exists) return 0;
  let failed = 0;
  let entries: Removable[];
  try { entries = listing.list(); } catch { return 1; }
  for (const entry of entries) {
    try { entry.delete(); } catch { failed += 1; }
  }
  return failed;
}

