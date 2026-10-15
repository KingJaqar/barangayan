// Simulated PostgREST for the R6 device run: serves get_routing_conditions_snapshot (schema 1, graph
// activated, R3-proposed entrances) and the seeded evacuation_centers rows. Not production code.
// Control: POST /__control {"closedEdgeIds":[...]} publishes a new revision with one closure.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';

const repo = process.argv[2];
const port = Number(process.argv[3] ?? 54399);
const graph = JSON.parse(readFileSync(`${repo}/data/routing-packs/ampid-1/pack/graph.json`, 'utf8'));
const edgesById = new Map(graph.edges.map(e => [e.id, e]));
const AREA = '00000000-0000-0000-0000-000000000001';

const centers = [
  ['00000000-0000-0000-0000-00000000c001', 'Ampid 1 Elementary', 'General Luna St, Ampid 1, San Mateo', 14.684583, 121.112071, 1000, 450, ['medical_desk', 'pet_friendly'], 'n11175955772', 'unknown'],
  ['00000000-0000-0000-0000-00000000c002', 'San Mateo Civic Center', 'Kambal Rd, Guitnang Bayan 2', 14.6835, 121.1155, 2000, 1640, ['generator'], 'n13165316139', 'available'],
  ['00000000-0000-0000-0000-00000000c003', 'Dulong Bayan Covered Court', 'Gen. Luna St, Dulong Bayan 1', 14.682, 121.114, 800, 800, [], 'n10250156647', 'available'],
  ['00000000-0000-0000-0000-00000000c004', 'Malanday National High School', 'P. Zamora St, Malanday', 14.681, 121.113, 800, 120, [], 'n674020408', 'unknown'],
];

let revision = 1;
let closures = [];
const log = [];

function snapshot(graphVersion) {
  const active = graphVersion === graph.version;
  return {
    schemaVersion: 1,
    areaId: 'ampid-1',
    revision,
    revisedAt: '2026-10-14T00:00:00Z',
    generatedAt: new Date().toISOString(),
    graphVersion,
    activeGraphVersion: graph.version,
    graphStatus: active ? 'active' : 'unregistered',
    closures: closures.map(c => ({ ...c, edgeIds: active ? c.edgeIds : null })),
    centers: centers.map(([id, name, , lat, lng, , , , entrance, availability]) => ({
      id, name, active: true, availability, availabilityUpdatedAt: '2026-10-14T00:00:00Z',
      position: { lat, lng }, entrancePosition: null, entranceNodeId: active ? entrance : null, revision: 1,
    })),
    tombstones: [],
  };
}

const rows = centers.map(([id, name, address, lat, lng, capacity, occupancy, facilities]) => ({
  id, barangay_id: AREA, name, address, position: { lat, lng }, capacity, current_occupancy: occupancy,
  is_active: true, contact_number: null, facilities, verified: true, deleted_at: null,
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z',
}));

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer((req, res) => {
  let body = '';
  req.on('data', d => (body += d)).on('end', () => {
    const path = req.url.split('?')[0];
    log.push(`${new Date().toISOString()} ${req.method} ${path}`);
    if (path === '/__log') return send(res, 200, log);
    if (path === '/__control' && req.method === 'POST') {
      const { closedEdgeIds } = JSON.parse(body || '{}');
      revision += 1;
      closures = (closedEdgeIds ?? []).length === 0 ? [] : [{
        id: '7a1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', label: 'Simulated closure', reason: 'R6 device test',
        observedAt: '2026-10-14T00:00:00Z', publishedAt: new Date().toISOString(), revision, sourceRefs: [],
        geometry: { type: 'MultiLineString', coordinates: closedEdgeIds.map(id => edgesById.get(id).geometry) },
        edgeIds: closedEdgeIds,
      }];
      return send(res, 200, { revision, closures: closures.length });
    }
    if (path === '/rest/v1/rpc/get_routing_conditions_snapshot') {
      const args = JSON.parse(body || '{}');
      return send(res, 200, snapshot(args.p_graph_version ?? graph.version));
    }
    if (path === '/rest/v1/evacuation_centers') return send(res, 200, rows);
    return send(res, 200, []);
  });
}).listen(port, '127.0.0.1', () => console.log(`sim backend on ${port}, graph ${graph.version}`));
