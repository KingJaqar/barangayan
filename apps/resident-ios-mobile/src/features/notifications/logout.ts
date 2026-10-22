import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@barangayan/shared';
import { residentApi } from '../../data/resident-api';
import type { Configuration } from '../../lib/config';
import { releaseGates } from '../../lib/release-gates';
import { releaseDevice } from './push-controller';
import { pushRecordStore } from './push-store';

/** A removal that takes longer than this is left to the retry marker; logout never waits on the network for long. */
const RELEASE_TIMEOUT_MS = 3000;

/**
 * Removes this iPhone's push token from the account that is signing out (A44-006). It must run while the session is still
 * valid, so the runtime calls it before closing the connection. The retry marker is written first: offline or on timeout the
 * removal is retried the next time the app opens or returns to the foreground, signed in or not (the server releases a token for
 * whoever holds it), and the next account to register this token takes it over. It never throws, so it can never block or fail a logout.
 */
export async function releaseDeviceForLogout(client: SupabaseClient<Database>, config: Configuration, userId: string | undefined): Promise<void> {
  if (!releaseGates.remotePush || !userId) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const release = releaseDevice({ api: residentApi(client, config.barangayId, userId), store: pushRecordStore(new URL(config.url).hostname), userId });
    await Promise.race([release, new Promise<void>((resolve) => { timer = setTimeout(resolve, RELEASE_TIMEOUT_MS); })]);
  } catch {
    // The marker already holds the retry.
  } finally {
    if (timer) clearTimeout(timer);
  }
}
