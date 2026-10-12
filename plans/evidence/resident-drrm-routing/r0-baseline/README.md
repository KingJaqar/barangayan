# R0 baseline — Resident DRRM weather routing

Recorded 2026-10-12 for `plans/Resident_DRRM_Weather_Routing_BFS_Dijkstra_Implementation_Plan.md`, phase R0. Every result below was produced by a command run on that date; nothing here is projected.

## Repository state

- Branch `main`, HEAD `6ae66e1a57effbe702b9c392d3db5057439e8f87` (`baseline-head.txt`).
- 139 pre-existing uncommitted paths (admin-web table work, resident-web UI, Android Centers/map edits, plan/evidence edits; `0110`–`0112` migrations untracked). Full list in `baseline-status.txt` (taken after this folder was created, so it also lists this folder). These are the user's work; R0 changed none of them.
- Plan-relevant files with uncommitted user edits: Android `emergency-info/index.tsx` (+/- 353 lines), `components/map-view.tsx`, `app.json`. R1 must build on these working-tree versions.

### Source hashes (sha256, first 16 hex; `M` = uncommitted edit)

| Hash | State | File |
|---|---|---|
| bb0e695f70d344ad | M | apps/resident-android-mobile/src/app/(app)/home/emergency-info/index.tsx |
| 5b620495affb57a7 | M | apps/resident-android-mobile/src/components/map-view.tsx |
| d5d6c8f909178be1 | | apps/resident-android-mobile/src/lib/emergency-cache.ts |
| 109d25175127377a | | apps/resident-android-mobile/src/app/_layout.tsx |
| de2a4bcee6bf2352 | M | apps/resident-android-mobile/app.json |
| f8632673af09ebc2 | | apps/resident-web/src/components/emergency/centers-content.tsx |
| c42c1efe1a9d2dd1 | | apps/resident-web/src/data/ampid1-boundary.json |
| 636049e4ace3b386 | | packages/shared/src/lib/osrm.ts |
| e85e11a981695cdf | | packages/shared/src/lib/haversine.ts |
| 35f83d42263177c6 | | packages/shared/src/lib/point-in-polygon.ts |
| 9d59951c0529f400 | | packages/shared/src/index.ts |
| cceeb453d0730db7 | | supabase/migrations/0044_evacuation_centers_verified.sql |
| 33cad5e972840229 | | supabase/seed.sql |
| 5b45228f210a6d66 | | supabase/config.toml |
| 8e3196c29f9a3dd3 | | supabase/functions/deno.json |

## Toolchain and dependencies

| Item | Version |
|---|---|
| Node | v24.13.1 |
| Supabase CLI (workspace `node_modules/.bin/supabase`) | 2.118.0 |
| Local edge-runtime image | `public.ecr.aws/supabase/edge-runtime:v1.76.2` (Deno 2.1.4); `config.toml` `deno_version = 2` |
| Docker | 29.8.1 |
| Global `deno` / `supabase` on PATH | not installed (use `npx supabase`, Docker) |
| Next.js (resident-web, admin-web) | 16.3.0, React 19.2.8, leaflet ^1.9.4, react-leaflet ^5.0.0 |
| Android app (`@barangayan/mobile`) | expo ^57.0.10, react-native 0.86.2, expo-location ~57.0.8, expo-file-system ~57.0.2, @react-native-community/netinfo ^12.0.1, react-native-webview 13.16.1 |
| `@barangayan/shared` | vitest ^3, TypeScript ~6.0.3, deps `@supabase/supabase-js`, `zod` |

## Test commands and baseline results

| Check | Command (run from) | Result | Log |
|---|---|---|---|
| Shared tests | `npx vitest run` (packages/shared) | pass — 24 files, 239 tests | `shared_test.log` |
| Shared typecheck | `npx tsc --noEmit -p .` (packages/shared) | pass, 0 errors | `shared_tsc.log` |
| Resident-web typecheck | `npx tsc --noEmit` (apps/resident-web) | pass, 0 errors | `web_tsc.log` |
| Resident-web lint | `npx eslint` (apps/resident-web) | 0 errors, **2 pre-existing warnings** (`location-verification-form.tsx:94`, `location-verification-map.tsx:102`) | `web_lint.log` |
| Android typecheck | `npx tsc --noEmit` (apps/resident-android-mobile) | pass, 0 errors | `and_tsc.log` |
| Android lint | `npx expo lint` (apps/resident-android-mobile) | 0 errors, **2 pre-existing warnings** (`health/register.tsx:2,33` import/no-duplicates) | `and_lint.log` |

Later phases must not add errors or warnings beyond these four.

## Migration sequence

- Highest repository prefix: `0112_admin_reference_index_writer_permissions.sql`; 110 files, no duplicate prefixes (some numbers unused). **Next new migration: `0113`.**
- Discrepancy: `AGENTS.md` says the last pushed migration is `0094`. That is stale. `0110`–`0112` are also untracked in git, so whether they are applied remotely is unverified; numbering still continues at `0113`.

## Coverage area and centers

Measured from `apps/resident-web/src/data/ampid1-boundary.json` (Polygon, 147 vertices incl. closing vertex, source "Google Maps High-Density Trace"): bbox lng 121.110227–121.127262, lat 14.673944–14.686638 → **1.83 km × 1.41 km, 1.281 km²** (local equirectangular projection).

| Seeded center (`0044` + `seed.sql`) | Position | Inside? | Distance to boundary |
|---|---|---|---|
| Ampid 1 Elementary | 14.684583, 121.112071 | inside | 0.0 m (on the line) |
| San Mateo Civic Center | 14.683500, 121.115500 | inside | 161.7 m |
| Dulong Bayan Covered Court | 14.682000, 121.114000 | inside | 150.5 m |
| Malanday National High School | 14.681000, 121.113000 | inside | 39.4 m |

**Data discrepancy for R3/R4 (DRRM review):** three seeded centers carry addresses in other barangays ("Kambal Rd, Guitnang Bayan 2", "Gen. Luna St, Dulong Bayan 1", "P. Zamora St, Malanday") while their coordinates sit inside the Ampid I trace, and the coordinates are rounded to 3–4 decimals. They look like placeholder positions. Before the R3 entrance review, DRRM must confirm each center's real location and whether it is an Ampid I center at all.

## Edge Function import bundling (verified)

Probes, all local (no deploy):

1. `edge-runtime bundle` (Docker image v1.76.2) on an entrypoint importing a file outside the function folder by a relative path with an explicit `.ts` extension: **bundles**.
2. Same, where that file has an **extensionless value import** (`from './core'`): **fails** — `Module not found … Maybe add a '.ts' extension`.
3. `npx supabase functions serve` with a temporary function importing `../../../packages/shared/src/lib/haversine.ts`: the CLI **did mount the outside file**, but the worker failed to boot because `haversine.ts` has an extensionless `import type … from '../types/map-bridge'` (`BOOT_ERROR`, module not found).
4. Same, importing the zero-import `packages/shared/src/lib/format.ts`: **served and returned `#VAC-042`** (`formatDriveRegistrationNumber(42)`).

The temporary function `supabase/functions/zz-r0-import-probe` was removed and the edge-runtime container stopped; `git status supabase/` shows no change from R0.

**Decision for R2/R5:** the pure routing module goes in `packages/shared` as a **single file with no imports** (types declared inline), as section 3.2 already requires. Edge Functions import it by relative path with the `.ts` extension; never through `packages/shared/src/index.ts` or any file with extensionless imports. The `supabase/functions/_shared/routing/` copy with a drift-hash test is **not needed** unless the deploy check below fails.

**Still unverified:** an actual `supabase functions deploy` (Docker bundling, or `--use-api` server-side bundling, which may resolve outside paths differently). Deploying is not authorized in R0; confirm on the first R5 deployment and fall back to the generated `_shared/routing/` copy if it fails.

## Supabase Edge Function limits (docs, fetched 2026-10-12)

From <https://supabase.com/docs/guides/functions/limits> (page shows no last-updated date): max memory **256 MB**; max CPU time **2 s** per request (async I/O excluded); wall clock 150 s Free / 400 s paid; request idle timeout 150 s; bundle size **20 MB** when bundled locally by the CLI, **5 MB** when bundled server-side.

Plan budgets (CPU < 1.5 s, memory < 192 MB) fit within these limits. The 5 MB server-side bundle cap matters if graph resources are ever bundled with `--use-api`; prefer loading packs as separate resources.

## Framework guidance read

- Next.js 16.3.0 installed docs (`node_modules/next/dist/docs/`): index, `01-app/01-getting-started/15-route-handlers.md` (Route Handlers; non-GET methods never cached; `route.ts` cannot share a segment with `page.tsx`), `02-guides/lazy-loading.md` (`next/dynamic` with `ssr: false` only from Client Components; relevant to Leaflet). resident-web consumes `@barangayan/shared` via workspace link; `next.config.ts` has no `transpilePackages`.
- Expo SDK 57 Location (<https://docs.expo.dev/versions/v57.0.0/sdk/location/>): `getForegroundPermissionsAsync`, `requestForegroundPermissionsAsync`, `hasServicesEnabledAsync`, `getCurrentPositionAsync`, `getLastKnownPositionAsync({ maxAge, requiredAccuracy })`, `watchPositionAsync` → `LocationSubscription.remove()` (foreground only), `Accuracy.High` = 4 (~10 m) vs default `Balanced` = 3 (~100 m), `coords.accuracy` in meters, `timestamp` ms, Android-only `mocked`. The library adds `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION`; background location and the foreground service stay off unless the config plugin enables them (it is not listed in `app.json` plugins, so the defaults apply). Installed-build permission verification remains an R1 task.

## Plan line references re-checked

| Plan reference | Current working tree |
|---|---|
| Android first fix `index.tsx:144-163` (Balanced, unconditional request) | still true (`:148` request, `:151` `Accuracy.Balanced`) |
| `handleLocateMe` `:586-604` | starts at `:586`; requests permission again at `:589` |
| Straight-line fallback `:540-543` | at `:540` |
| `map-view.tsx:68,81,194` unpkg/tiles; `attributionControl` | unpkg `:68`, `:81`; tiles `:194`; `attributionControl: false` at `:191` |
| `emergency-cache.ts:4` 30-min TTL | still true |
| `_layout.tsx:151-169` `Stack.Protected` | now `:160-173` |
| Web `centers-content.tsx:23,40,45-57` | `geoDenied` `:23`; `getCurrentPosition` `:38`; `selectCenter` `:45` |
| OSRM demo dependency `packages/shared/src/lib/osrm.ts` | present (`router.project-osrm.org/route/v1/foot`) |

## Not completed in R0

- **RRL PDF visual check (Table 1 values, `t(e)` upper bound): pending.** The PDF is not in the repository. The article page (<https://www.atlantis-press.com/proceedings/wctp-25/126023805>) loaded in the built-in browser, but the PDF link (`https://www.atlantis-press.com/article/126023805.pdf`) was refused by the browser pane. Saving the PDF is a file download that needs the owner's approval. Until it is read, the `t(e)` bound and Table 1 constants must not be committed (plan section 7).
