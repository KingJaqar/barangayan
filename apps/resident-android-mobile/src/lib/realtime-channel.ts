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
 * guarantees every call site gets its own topic, so concurrent mounts — and the
 * remount-then-mount race left by an in-flight async `removeChannel()` — can never
 * collide. The human-readable base is kept as a prefix purely for debugging in the
 * Supabase realtime inspector.
 */
export function uniqueChannelName(base: string): string {
  counter += 1;
  return `${base}:${counter}`;
}
