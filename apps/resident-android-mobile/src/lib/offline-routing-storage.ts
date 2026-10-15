import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

import type { PackFiles, RoutingStorage } from './offline-routing';

/**
 * Document-directory storage for the offline routing store (plan R6). It survives sign-out and
 * app restarts and is independent of the 30-minute emergency cache.
 */
export function documentRoutingStorage(areaId: string): RoutingStorage {
  const root = new Directory(Paths.document, 'routing', 'v1', areaId);
  const fileAt = (path: string) => new File(root, ...path.split('/'));
  const directoryAt = (path: string) => new Directory(root, ...path.split('/'));
  const ensureParent = (file: File) => file.parentDirectory.create({ intermediates: true, idempotent: true });

  return {
    async readText(path) {
      const file = fileAt(path);
      if (file.exists) return file.text();
      // The complete text reaches `.tmp` before the target is replaced, so a missing target
      // with a temporary file means the replacement was interrupted after the write.
      const pending = fileAt(`${path}.tmp`);
      return pending.exists ? pending.text() : null;
    },
    async writeText(path, text) {
      const target = fileAt(path);
      const pending = fileAt(`${path}.tmp`);
      ensureParent(pending);
      pending.write(text);
      await pending.move(target, { overwrite: true });
    },
    async removeFile(path) {
      for (const file of [fileAt(path), fileAt(`${path}.tmp`)]) if (file.exists) file.delete();
    },
    async removeDirectory(path) {
      const directory = directoryAt(path);
      if (directory.exists) directory.delete();
    },
    async moveDirectory(from, to) {
      const destination = directoryAt(to);
      if (destination.exists) destination.delete();
      destination.parentDirectory.create({ intermediates: true, idempotent: true });
      await directoryAt(from).move(destination);
    },
    async moveFile(from, to) {
      const source = fileAt(from);
      if (!source.exists) return;
      const destination = fileAt(to);
      ensureParent(destination);
      await source.move(destination, { overwrite: true });
    },
    async list(path) {
      const directory = directoryAt(path);
      return directory.exists ? directory.list().map(entry => entry.name) : [];
    },
    sha256: text => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text, { encoding: Crypto.CryptoEncoding.HEX }),
  };
}

/**
 * The routing pack shipped inside the app (R3 build output). Metro bundles the JSON as data, so
 * the builder's exact bytes are reproduced with JSON.stringify (the builder writes
 * `JSON.stringify(graph)` and `JSON.stringify(map)`) and then hash-checked like any other pack.
 */
export function bundledAmpidPack(): PackFiles {
  // Required lazily: the large JSON modules are evaluated only when a pack is installed or repaired.
  const manifest: unknown = require('../../../../data/routing-packs/ampid-1/pack/manifest.json');
  const graph: unknown = require('../../../../data/routing-packs/ampid-1/pack/graph.json');
  const map: unknown = require('../../../../data/routing-packs/ampid-1/pack/map.json');
  return { manifest: JSON.stringify(manifest), graph: JSON.stringify(graph), map: JSON.stringify(map) };
}

/** Graph version of the bundled pack, read from its small manifest only. */
export function bundledAmpidPackVersion(): string | null {
  const manifest: unknown = require('../../../../data/routing-packs/ampid-1/pack/manifest.json');
  return typeof manifest === 'object' && manifest !== null && 'graphVersion' in manifest && typeof manifest.graphVersion === 'string' ? manifest.graphVersion : null;
}
