/**
 * R10 pilot-load probe for the connected route service.
 *
 * Simulates N devices that each ask for a route every INTERVAL seconds for DURATION seconds
 * (the cadence of a visible Centers screen, plan section 4), with synthetic origins inside Ampid I.
 * Prints latency percentiles and a status histogram as JSON. Origins are synthetic; no resident
 * data is involved.
 *
 * Run it only against a function the owner has authorized for load. All devices share this
 * machine's network address, so the per-address limit (300/minute) applies to the total:
 * 50 devices at 30 s is 100/minute.
 *
 *   ROUTE_URL=https://<project>.supabase.co/functions/v1/evacuation-route \
 *   ANON_KEY=<publishable or anon key> node load-probe.mjs [devices=50] [durationSeconds=120] [intervalSeconds=30]
 *
 * Pilot target (plan R10): connected p95 <= 3000 ms and every answer 200. Any other status (429,
 * 503, a timeout) is reported, not retried: the probe measures what residents would see.
 */
const url = process.env.ROUTE_URL;
const key = process.env.ANON_KEY;
if (!url || !key) throw new Error('Set ROUTE_URL and ANON_KEY');
const devices = Number(process.argv[2] ?? 50);
const durationMs = Number(process.argv[3] ?? 120) * 1000;
const intervalMs = Number(process.argv[4] ?? 30) * 1000;
if (![devices, durationMs, intervalMs].every(n => Number.isFinite(n) && n > 0)) throw new Error('Arguments must be positive numbers');

const latencies = [];
const statuses = new Map();
const note = (status, ms) => {
  statuses.set(status, (statuses.get(status) ?? 0) + 1);
  if (status === 200) latencies.push(ms);
};

async function device(index) {
  // Spread the devices over the barangay and stagger their first request across one interval.
  const origin = {
    lat: 14.6755 + (index % 5) * 0.0018,
    lng: 121.1125 + (Math.floor(index / 5) % 5) * 0.0028,
    accuracyMeters: 10,
    revision: 1,
  };
  await new Promise(resolve => setTimeout(resolve, (index / devices) * intervalMs));
  const stop = Date.now() + durationMs;
  while (Date.now() < stop) {
    const started = performance.now();
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', apikey: key, authorization: `Bearer ${key}` },
        body: JSON.stringify({ origin, graphVersion: null, originEdgeId: null, centerId: null, avoidEdgeIds: [], minConditionsRevision: null }),
        signal: AbortSignal.timeout(10_000),
      });
      await response.arrayBuffer();
      note(response.status, performance.now() - started);
    } catch {
      note('network_or_timeout', performance.now() - started);
    }
    origin.revision += 1;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
}

await Promise.all(Array.from({ length: devices }, (_, i) => device(i)));

const sorted = [...latencies].sort((a, b) => a - b);
const pct = p => (sorted.length === 0 ? null : Math.round(sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]));
const total = [...statuses.values()].reduce((a, b) => a + b, 0);
console.log(JSON.stringify({
  devices,
  durationSeconds: durationMs / 1000,
  intervalSeconds: intervalMs / 1000,
  requests: total,
  statuses: Object.fromEntries([...statuses.entries()].map(([k, v]) => [String(k), v])),
  latencyMs: { count: sorted.length, p50: pct(50), p95: pct(95), max: sorted.length === 0 ? null : Math.round(sorted[sorted.length - 1]) },
  meetsTarget: sorted.length > 0 && pct(95) <= 3000 && statuses.size === 1 && statuses.has(200),
}, null, 2));
