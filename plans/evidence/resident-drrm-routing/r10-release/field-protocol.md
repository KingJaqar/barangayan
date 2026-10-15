# R10a field protocol: physical phone and DRRM drill (closure routing)

Procedure and result sheet for the evidence that needs a **physical Android phone** and **barangay DRRM**. Nothing in this file has been run: every result cell is empty on purpose, and no row may be marked passed without the observation written next to it. Findings recorded here are field observations; label simulated or emulator results as such.

Companion documents: `plans/Resident_DRRM_Routing_Release_Recovery_Runbook.md` (controls, rollback) and `README.md` in this folder (status and automated results).

## 0. Preconditions (stop if any is false)

| # | Precondition | Owner | Confirmed |
|---|---|---|---|
| P1 | DRRM has confirmed the location, entrance and availability of the **five remaining centers**, set through admin-web (hosted today: two routable, five not). Without this most of the list is unroutable and the drill tests a two-center service. | DRRM | |
| P2 | R3 topology review signed off: `plans/evidence/resident-drrm-routing/r3-pack-builder/build/report.md` (14 bridges, entrances, east-edge connectivity, barriers, private-access ways). | DRRM | |
| P3 | A release-type Android build (EAS preview APK or newer) is installed on a **physical** phone. Record model, Android version, build id, `versionCode`, and the `graphSha256` shown in route provenance. | Developer | |
| P4 | `evacuation-route` is deployed, graph active, `EVACUATION_ROUTE_ENABLED` unset or `true` (runbook section 2). | Owner | |
| P5 | A second device or a laptop with the resident web app for agreement checks. | Developer | |
| P6 | Charged phone with a data plan or Wi-Fi, and a SIM-less or airplane-mode fallback for section 4. Test accounts and the DRRM admin session are not needed for public routing. | Developer | |

Record: date, place, weather, people present, phone model/OS, build id.

## 1. Device-location matrix (R1 exit gate, outdoors inside or near Ampid I)

Run on the physical phone. "Accepted" means the marker, the origin used for routing and the first route all use the device coordinates; manual placement does not count.

| # | Case | Steps | Expected | Result | Notes |
|---|---|---|---|---|---|
| L1 | Cold start, permission granted, outdoors | Force-stop the app, open Emergency, Centers | Fix acquired automatically, marker at your position, route computed | | |
| L2 | First run, permission not yet asked | Clear app permission, open Centers | No automatic prompt; "Use my location" asks once; grant; fix accepted | | |
| L3 | Permission denied, then granted in Settings | Deny, return, open Settings through the card, grant, return | Card recovers without restart; no repeated prompt while denied | | |
| L4 | Approximate location only | Grant "approximate" only | Fix flagged approximate and held for confirmation, never silently accepted | | |
| L5 | Location services off | Turn device location off | "Location is off" with an Open settings action; turning it on resumes | | |
| L6 | Airplane mode, GPS only | Enable airplane mode, then Centers | Fix acquired offline (GPS needs no data); route from the stored pack | | |
| L7 | Indoors / poor accuracy | Stand indoors | Progress after 10 s, stop at 45 s with a clear message; last-known offered for confirmation only | | |
| L8 | Accuracy over 50 m near several streets | Observe a poor fix on a street junction | Street chooser appears; no silent guess | | |
| L9 | Outside coverage | Open Centers 500 m+ outside the barangay | `outside_coverage` message; manual placement still allowed | | |
| L10 | Move 100 m, press Locate me | Walk, press the button | Origin revision advances; route restarts from the new position | | |
| L11 | Background and return | Press Home during acquisition, return | Acquisition stopped on background, restarted on return, no stuck spinner | | |

Exit gate: L1 and L6 pass on the physical phone.

## 2. Closure, bridge and center changes during active use

An administrator edits conditions in admin-web while the phone and the web page show a route. Record the time of each publish and the time the phone changed.

| # | Change | Steps | Expected | Result | Seconds to reach phone |
|---|---|---|---|---|---|
| C1 | Publish a closure on the displayed route | Select a segment on the route, publish with an observation time | Route invalidated at once on next conditions refresh, rerouted around it, closure listed | | |
| C2 | Reopen it with a reason | Reopen from the history list | Route may return to the original path | | |
| C3 | Closure on a bridge approach (one of the 14 in the R3 report) | Publish, check a route that used the bridge | Route avoids it or reports no route; no route crosses it | | |
| C4 | Center set `unavailable` | Mark the center the route ends at | Phone picks another confirmed-available center; unavailable one not chosen | | |
| C5 | Center entrance cleared and re-set | Clear, then set | Center unroutable, then routable again; list shows no distance for it meanwhile | | |
| C6 | Same change while the phone is offline | Airplane mode, publish, reconnect | Old conditions with an age label while offline; the closure applies after reconnect | | |

## 3. Connected and local agreement on identical snapshots

| # | Check | Steps | Expected | Result |
|---|---|---|---|---|
| A1 | Same origin, same snapshot revision, connected vs local | At a fixed origin note the route distance and the conditions revision in connected mode; airplane mode; read the local route at the same revision | Same center, same distance and edge sequence | |
| A2 | Ten origins | Repeat A1 at ten spread points | All identical | |

Automated agreement for 25 origins with and without a closure passes in `supabase/functions/evacuation-route/handler.test.ts` (see README). A1 and A2 confirm it on the device's Hermes engine.

## 4. 72-hour Android outage

| Step | Detail |
|---|---|
| Setup | Fully charged phone, build from P3, Centers screen opened once online so the pack, conditions and centers are stored. Note the conditions revision and checked time. Mark one road as blocked locally (a resident avoidance mark). |
| Outage | Airplane mode (Wi-Fi and data off) for **72 hours of wall-clock time**. The phone may be used normally and may reboot once. If 72 hours is not possible, a device clock advance is a weaker simulation and must be labelled as such. |
| Checkpoints | 0 h, 1 h, 24 h, 48 h, 72 h: open Centers from a cold start without network |
| Expected at every checkpoint | Map and routes appear within 5 s without waiting for GPS; routes compute from stored data; the closure and the local mark still apply; the conditions age grows and the stale warnings appear (conditions older than 15 min, center details older than 24 h); no crash, no blank map. |
| After a reboot | Same as above. |
| Recovery | Turn airplane mode off. Expected: connected mode returns within about 40 s, conditions refresh, local mark unchanged. |

| Checkpoint | Cold start to map (s) | Route computed | Closure applied | Local mark kept | Stale warning shown | Notes |
|---|---|---|---|---|---|---|
| 0 h | | | | | | |
| 1 h | | | | | | |
| 24 h | | | | | | |
| 48 h | | | | | | |
| 72 h | | | | | | |
| After reboot | | | | | | |
| After reconnect | | | | | | |

## 5. Timing and resource measurements (physical phone)

| # | Measurement | Method | Target | Result |
|---|---|---|---|---|
| T1 | Map usable from cold start, no GPS wait | Screen-record a force-stop then open, count to the drawn map with roads (do not wait for the fix) | at most 5 s | |
| T2 | Local route calculation p95 | Temporary probe build like R6's (`plans/evidence/resident-drrm-routing/r6-offline/tools/r6-probe.tsx.txt`): 200 routes over spread origins on the installed pack, yielding; remove the probe afterwards | at most 2 s | |
| T3 | Connected route p95 under the documented pilot load | `node plans/evidence/resident-drrm-routing/r10-release/load-probe.mjs 50 300 30` against the authorized function (50 devices, one request each 30 s, 5 minutes) | at most 3 s, all 200 | |
| T4 | Function CPU and memory | Supabase function logs/metrics during T3 | CPU under 1.5 s, memory under 192 MB per invocation | |
| T5 | Phone memory | `adb shell dumpsys meminfo com.barangayan.resident` with the map open | record; no growth over 10 repeated route requests | |
| T6 | Phone storage | App info storage; the stored pack is about 626 KB | pack at most 5 MB (hard 20 MB) | |

## 6. Rollout and rollback rehearsal on the deployed function

| # | Step | Expected | Result |
|---|---|---|---|
| R1 | Record a route answer (status 200) | route returned | |
| R2 | `supabase secrets set EVACUATION_ROUTE_ENABLED=false` | within seconds: POST returns `503 service_disabled`; web shows the paused wording and no route; Android shows the on-phone route with the labelled note | |
| R3 | While paused, publish a closure | applies on the phone and on the next resume | |
| R4 | `supabase secrets set EVACUATION_ROUTE_ENABLED=true` | route answers again; Android returns to the service route within about 40 s | |
| R5 | Mistype the value (`off`) briefly on a test run only if the owner agrees | paused, `rollout_flag_invalid` in logs; then restore `true` | |

Time from the secrets command to the first `503` and to the first `200` after resume: ______ s / ______ s.

## 7. Drill (DRRM-led, closure routing only)

A table-top plus walking drill with DRRM staff. The app must not be described as weather-aware.

1. DRRM publishes two closures and marks one center unavailable on admin-web.
2. Volunteers on phones (at least one in airplane mode) walk or simulate from three starting streets to the center the app recommends.
3. Record for each: starting street, recommended center, route length, whether the route matched DRRM's expectation, any road the route used that is actually impassable.
4. DRRM reopens one closure; confirm the change reaches every phone.

| Volunteer | Phone / mode | Start street | Recommended center | Matched DRRM expectation | Impassable road used | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |

Outcome and sign-off (name, role, date): ____________________
