import type { Database } from '@barangayan/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { File } from 'expo-file-system';
import { printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { privateFile } from '../../lib/private-files';
import { callFunction } from './function-call';
import { EXPORT_CONTRACT_VERSION } from './export-contract';
import type { ExportDeps } from './export-run';

/** The device-backed export adapter: the v2 function, `expo-print`, `expo-file-system` (private cache folder) and `expo-sharing`. */
export function exportDeps(client: SupabaseClient<Database>): ExportDeps {
  return {
    request: () => callFunction(client, 'export-my-data', { contractVersion: EXPORT_CONTRACT_VERSION }),
    writeJson(name, text) {
      const target = privateFile(name);
      if (target.file.exists) target.file.delete();
      target.file.create();
      target.file.write(text);
      return target;
    },
    async renderPdf(name, html) {
      const rendered = await printToFileAsync({ html, width: 612, height: 792 });
      const source = new File(rendered.uri);
      const target = privateFile(name);
      try {
        if (target.file.exists) target.file.delete();
        await source.copy(target.file);
      } finally {
        try { if (source.exists) source.delete(); } catch { /* purged with the private folders */ }
      }
      return target;
    },
    canShare: isAvailableAsync,
    async share(uri, format) {
      await shareAsync(uri, format === 'pdf' ? { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'My data' } : { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'My data' });
    },
    now: () => new Date(),
  };
}
