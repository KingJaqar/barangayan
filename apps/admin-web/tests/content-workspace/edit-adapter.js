// Only bundled when explicitly running the isolated browser regression suite.
// This adapter never contacts a database; it records synthetic write attempts.
export function createSupabaseBrowserClient() {
  return {
    channel() { return { on() { return this; }, subscribe() { return this; } }; },
    removeChannel() {},
    from(table) {
      let values;
      const query = {
        update(payload) { values = payload; return this; },
        insert(payload) { values = payload; return this; },
        eq() { return this; }, select() { return this; },
        single() { return this; }, maybeSingle() { return this; },
        then(resolve, reject) {
          const state = globalThis.__contentEditTest ??= { writes: [], fail: false, delay: 0 };
          state.writes.push({ table, values });
          return new Promise(done => setTimeout(() => done({
            data: state.fail ? null : { id: 'preview-saved', title: values?.title },
            error: state.fail ? { message: 'Preview save failed' } : null,
          }), state.delay)).then(resolve, reject);
        },
      };
      return query;
    },
  };
}
