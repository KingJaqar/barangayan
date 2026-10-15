import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export const REFRESH_COALESCE_MS = 300;

/**
 * Collapses a burst of signals into one call after `delay` ms (plan P02-T03). `cancel`
 * drops a pending call, so nothing fires after the owner is disposed.
 */
export function createCoalescer(run: () => void, delay = REFRESH_COALESCE_MS) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let active = true;
  return {
    signal() {
      if (!active) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = undefined; if (active) run(); }, delay);
    },
    cancel() {
      active = false;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
  };
}

export type ChangeSource = { table: string; filter?: string };

let channelSequence = 0;

/**
 * Subscribes to row changes as a *refresh signal only*: callers re-read authoritative data
 * instead of trusting the payload (plan B24). Each subscription gets its own channel name
 * so two screens never share or tear down each other's channel. Returns the cleanup.
 */
export function subscribeToChanges(client: Pick<SupabaseClient, 'channel' | 'removeChannel'>, name: string, sources: ChangeSource[], onChange: () => void): () => void {
  if (!sources.length) return () => undefined;
  const coalescer = createCoalescer(onChange);
  let channel: RealtimeChannel = client.channel(`ios-${name.replace(/[^a-zA-Z0-9_-]/g, '_')}:${++channelSequence}:${Date.now().toString(36)}`);
  for (const source of sources) {
    channel = channel.on('postgres_changes', { event: '*', schema: 'public', table: source.table, ...(source.filter ? { filter: source.filter } : {}) }, () => coalescer.signal());
  }
  channel.subscribe();
  return () => {
    coalescer.cancel();
    void client.removeChannel(channel);
  };
}
