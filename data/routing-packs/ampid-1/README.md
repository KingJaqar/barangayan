# Ampid I routing pack

Inputs and outputs of the R3 pack build (`plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`). Map data © OpenStreetMap contributors, available under the Open Database License (ODbL 1.0); any app showing these maps or routes must display that attribution.

## Inputs (`source/`)

| File | Contents |
|---|---|
| `osm-extract.json` | Overpass `[out:json]` response from the query below. Fetched 2026-10-12 from overpass-api.de with the owner's approval (OSM base `2026-10-12T13:29:57Z`, 1,099,002 bytes, SHA-256 `4b3c6a6e85cd5774546dd180618f7d1d4ca4085e383f1146caf88a85b8a131c6`). |
| `centers.json` | Evacuation centers from `supabase/seed.sql`. Placeholder positions until DRRM confirms them. |
| *(boundary)* | `apps/resident-web/src/data/ampid1-boundary.json` (Google Maps trace, approximate). |
| *(stations)* | None yet. Add `stations.json` (`{ "stations": [{ "stationId", "lat", "lng" }] }`) only with verified PAGASA positions. |
| `sensor-stations.json` | R8 station set read by the `flood-shadow` function: `verification` (source, date, reviewer; `null` = unverified) and, per station, position, Alert/Alarm/Critical levels, historical baseline, datum and declared reading interval. Empty and unverified until DRRM/PAGASA data exists. Its station ids must equal those of `stations.json`, which the pack build reads for the 2 km edge tables; rebuild the pack whenever either file changes. |
| `terrain.json` | R8 terrain metadata (`source`, `licensed`, `verticalDatum`, `verticalRmseMeters`) for the flood grid elevations; `terrain: null` while no licensed DEM is in the grid. |

Overpass query (`https://overpass-api.de/api/interpreter`, POST, `Accept: application/json`). The box is the boundary plus the 150 m coverage margin, plus about 100 m so water and walls near the edge are kept as attachment barriers. Keep `timeout:25` and `maxsize`: larger reservations are refused with HTTP 504 ("server is probably too busy"):

```text
[out:json][timeout:25][maxsize:67108864][bbox:14.6715,121.1075,14.6890,121.1300];
(
  way["highway"];
  way["waterway"];
  way["natural"="water"];
  way["landuse"="reservoir"];
  way["barrier"];
  relation["natural"="water"];
  relation["waterway"="riverbank"];
);
(._;>;);
out body qt;
```

## Build

From `packages/shared`:

```bash
npm run build:routing-pack -- --area ampid-1 --osm ../../data/routing-packs/ampid-1/source/osm-extract.json --boundary ../../apps/resident-web/src/data/ampid1-boundary.json --centers ../../data/routing-packs/ampid-1/source/centers.json --out ../../data/routing-packs/ampid-1/pack --report ../../plans/evidence/resident-drrm-routing/r3-pack-builder/build
```

The same inputs give byte-identical files. `pack/manifest.json` lists every resource with its size and SHA-256. Files marked `device` (`graph.json`, `map.json`, `manifest.json`) go to Android (R6) and the route service (R5). `server/grid-*.json` stays server-side.
