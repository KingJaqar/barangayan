let counter = 0;

/**
 * Builds a realtime channel name that is unique per subscription instance.
 *
 * Supabase's `supabase.channel(topic)` returns the *same* channel object for a given
 * topic string, even across separate hook instances. If two components mount a hook
 * that subscribes to a fixed topic at the same time (e.g. the same screen rendered
 * twice, or two routes that both render the same hook), the second `.subscribe()`
 * call throws because the channel is already subscribed — a hard render crash, not a
 * race condition.
 *
 * Appending a monotonically increasing counter (scoped to this JS module instance)
 * guarantees every call site gets its own topic. Recreated here rather than imported —
 * this is a mobile-local file, not exported from @barangayan/shared (see the plan's §3
 * Realtime Contract Inventory). Ported verbatim from
 * apps/resident-android-mobile/src/lib/realtime-channel.ts.
 */
export function uniqueChannelName(base: string): string {
  counter += 1;
  return `${base}:${counter}`;
}
