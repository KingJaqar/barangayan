# P02 implementation and verification record — 2026-10-14

**Tasks:** P02-T01 … P02-T08. **Requirements:** A51-001…027 (Phase 2-primary rows), A50-037/038; contracts B04, B06, B07, B12, B13, B16, B21, B23, B24 (adapters in this phase) and the B01–B24 inventory below; D01/D03/D06/D11/D12/D19/D20 state primitives; G19 foundation; F02–F08/F11 client portions.
**Source revision:** uncommitted (base `2e5681c`, on top of the uncommitted Phase 1 work). **Native build:** none (OD-04: signed build deferred). **Backend/environment:** hosted project from `apps/resident-ios-mobile/.env`, read-only HEAD checks only. **Owner / reviewer:** KingJaqar (OD-01); review pending.

Entry note: the Phase 1 exit is not verified (signed build deferred). Per owner decision OD-04 this phase implemented and tested everything that needs no signed build or device; every native/Keychain/file/location proof stays blocked behind that build. Nothing below is device evidence.

## 1. Baseline before editing (same session)

| Check | Result |
|---|---|
| iOS `npm run typecheck` | exit 0 |
| iOS `npm run lint` | exit 0 |
| iOS `npm test` | 13/13 passed (4 files) |
| iOS `npx expo export --platform ios` | exit 0 |
| `packages/shared` `npx vitest run` | 419/419 passed (29 files) |

## 2. What changed (by task)

### P02-T01 — typed adapters and stable public error classification
- `src/data/outcome.ts`: `FailureKind` (`cancelled`, `offline`, `timeout`, `session`, `authorization`, `not-found`, `conflict`, `rate-limited`, `validation`, `schema`, `http`, `unknown-commit`, `unknown`), `DataError`, `classifyFailure`. Classification follows the verified library shapes: postgrest-js resolves transport failures with `status: 0` (abort → hint "Request was aborted"); storage-js uses `StorageApiError` (numeric `status`) and `StorageUnknownError` (network). With `write: true`, transport failures and 5xx become `unknown-commit`.
- `src/data/boundary.ts`: `parseRows` / `parseMaybeRow` / `parseRow` / `parseCount` / `checkWrite`; valid empty data, absent record, schema drift, HTTP/authorization and cancellation are distinct; raw payloads never enter error messages; unknown fields are stripped.
- `src/data/schemas.ts`: strict resident-safe response schemas with explicit column lists for every read the iOS screens perform.
- `src/data/resident-api.ts` rewritten: explicit columns, tenant/owner/active/deleted predicates, id tie-break ordering, page-range reads, server-side search, by-id detail reads (`drive`, `faqArticle`) instead of loading whole lists to find one row, malformed links return the not-found state without a query, emergency content reads `emergency_information` (B13).
- `src/lib/errors.ts`: `residentError` now maps contract codes first (all previous code messages kept), then the failure kind.
- Removed unused adapters `household` (read the canonical table, contradicting OD-02 B04 rule) and `registrations` (no caller); their contracts belong to P05/P16.

**B01–B24 adapter inventory**

| B | Adapter state after P02 | Owning phase for the rest |
|---|---|---|
| B01 Auth, B02 setup, B03 profile | Runtime session restore/validation unchanged; no new adapter | P04, P05, P06 |
| B04 household | Unused canonical-table reader removed | P05 (profile JSON contract) |
| B05 ID evidence | Storage primitives ready (owned paths, signed previews, staged refs) | P05, P08 |
| B06 catalogue | `documents(search)` paged + `document(id)` | P07 (charter fields) |
| B07 requests | paged `requests()`, `request(id)`, `cancelRequest` with reconciliation; `createRequest` remains the defective-baseline direct insert | P08 (submit_service_request), P09 |
| B08–B10 SLA/payments | none | P09, P10 |
| B11 incidents | counts only | P12 |
| B12 announcements/reads | paged `announcements()`, `announcement(id)`, `reportCounts` (strict counts), idempotent `markAnnouncementRead` | P11 |
| B13 emergency/centers | `emergencyInformation`, `centers` (complete bounded reads for caching) + public cache | P13, P14 |
| B14, B15 | none | P15 |
| B16 drives | paged `drives(search)`, `drive(id)`, `registerForDrive` with strict result parse and reconciliation | P16 |
| B17–B20 | none | P04, P17, P18 |
| B21 help/info | paged `faq()`, `faqArticle(id)`, paged `information()` | P18 |
| B22 processors | location adapter only | P12–P14 |
| B23 storage | `file-validation.ts`, `staged-uploads.ts`, `files.ts` | P05, P08, P12 |
| B24 realtime | `subscribeToChanges` (unique channel, coalesced, cleanup) used by lists and Reports counters | feature phases |

### P02-T02 — cancellation, timeouts, scope keys, stale replies, single flight
- Existing 20 s fetch timeout and session-closing abort kept (`runtime.tsx`). Every read takes an `AbortSignal`; a reply after cancellation is dropped (`boundary.ts`, `pagination.ts`, `use-public-resource.ts`).
- `src/data/scope.ts`: environment + tenant + account (+ parts) key used by drafts and staged uploads.
- `src/data/mutation.ts` `createSingleFlight`: one in-flight attempt; outcomes `committed` / `failed(kind)` / `unknown` / `busy`; no automatic retry. Used by request cancellation and mark-as-read; both re-read server state after every outcome.
- Verified library behaviour: postgrest-js retries only GET/HEAD/OPTIONS (3 attempts, 1/2/4 s backoff); POST/PATCH/RPC writes are never retried (decision P02-D09).

### P02-T03 — pagination, search, realtime, list states
- `src/data/pagination.ts` `PagedList`: 25-row pages, generation-tagged reads (late replies from a superseded query/owner dropped and aborted), id de-duplication across page shifts, first-page refresh for reconciliation, stale-but-visible rows on refresh failure, no automatic load-more loop after a failure (explicit `retry`), oversize-page rejection; `readAll` for small public sets refuses silent truncation; `listPresentation` separates loading / error / true empty / no-results.
- `src/data/use-paged-resource.ts`: account/epoch/query-scoped hook, foreground reload, realtime reload; `useDebouncedValue` (300 ms).
- `src/data/realtime.ts`: `createCoalescer` (300 ms) and `subscribeToChanges`; `ReportCountsProvider` refactored onto them.
- `src/components/resource-list.tsx` rewritten for paged state: skeleton, error with retry, stale banner with last-updated time, true-empty vs no-results copy, load-more spinner and explicit "Load more" after a failure.
- Screens moved to incremental pages: Services (server-side name/description search), Health (title/location/type label/ISO date search), My requests, Reports announcements, Help, Resident information (emergency sections excluded server-side). Realtime refresh sources: `document_types`, `medical_drives` and `announcements` by tenant, `service_requests` by resident.

### P02-T04 — protected persistence
- `src/lib/protected-drafts.ts`: Keychain-only draft store bound to environment/tenant/account/kind/schema version; index written before each value so interrupted writes are still purgeable; failed removals stay indexed and are reported; no plaintext fallback.
- `src/lib/drafts.ts`: same Keychain service/accessibility as the session (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`); AsyncStorage purge tombstone finished on next launch.
- `src/lib/runtime.tsx`: fresh install (Keychain survives reinstall) and forced clear purge all drafts; a pending purge is finished at launch; validating a different account purges other accounts' drafts (failure sets the tombstone); logout purges all drafts before the epoch reset and reports "Local cleanup needs retry" on failure.
- Consumers (request/concern/profile forms) arrive in P05/P08/P12.

### P02-T05 — files, images, uploads
- `src/lib/file-validation.ts`: actual-byte sniffing (JPEG/PNG/WebP/PDF; HEIF recognised only to explain it), per-purpose policies copied from the bucket migrations (request attachments 5 MiB incl. PDF; ID images 5 MiB; incident photos 10 MiB; avatars 2 MiB), final-byte size check, metadata removal (JPEG APP1/APP13/COM with Orientation re-emitted alone; PNG `tEXt`/`zTXt`/`iTXt`/`eXIf`/`tIME`; WebP `EXIF`/`XMP ` chunks and VP8X flags), safe display names, owned `{uid}/{uploadId}/{slot}.{ext}` paths.
- `src/lib/staged-uploads.ts`: `uploadOwned` (`upsert: false`, identical-bytes reconciliation, `unknown-commit` otherwise), `createSignedPreview` (owner path, HTTPS, 300 s, refresh 30 s early), staged-reference ledger in protected storage with cleanup that removes only client-deletable objects and returns `serverCleanupRequired` for the rest.
- `src/lib/files.ts`: Files picker via `File.pickFileAsync` (verified native: `UIDocumentPickerViewController(..., asCopy: true)`), size pre-check, read once, temporary copy deleted; iCloud/read failure explained.
- Dependency: `expo-file-system ~57.0.2` declared in the iOS workspace (already in the root lockfile for Android; no resolved version changed).

### P02-T06 — device location
- `packages/shared/src/lib/device-location.ts`: additive `LocationPlatform = 'android' | 'ios' | 'web'`; iOS wording for reduced accuracy (Precise Location), blocked permission (Settings) and Location Services off (no Settings deep link on iOS). Android and web outputs unchanged (new shared test asserts both).
- `src/lib/location-core.ts` (pure mapping: `ios.accuracy === 'reduced'` → approximate) and `src/lib/device-location.ts` (`useDeviceLocation`: one controller per screen, background pause, foreground resume re-checks permission, cancel on unmount).
- Dependency: `expo-location ~57.0.8` declared (already in the lockfile). `app.config.ts`: `expo-location` plugin with When In Use purpose string only; Always/Always-and-When-In-Use/motion keys removed (`false`), no background mode. `expo config --type introspect` shows only `NSLocationWhenInUseUsageDescription`.

### P02-T07 — public emergency cache and private policy
- `src/data/public-cache.ts`: AsyncStorage envelope (format, environment, tenant, key, contract version, fetch time); mismatched/corrupt entries discarded; `fresh`/`stale`/`expired` (clock moved backwards = expired); write failure reported, not thrown. Policies (decision P02-D04): emergency content stale 24 h / expired 30 d; centers stale 30 min / expired 24 h.
- `src/data/use-public-resource.ts`: shows the cached copy first with its age, replaces it with the server answer, keeps the labelled copy on failure, reports when the copy could not be saved. Emergency screen (still behind the closed `emergencyContent` gate) uses it.
- Private policy: private reads stay in memory (`useResource`, `usePagedResource`); private drafts only in the Keychain store; no offline mutation/attendance queue.

### P02-T08 — tests (client/controller scope; mocks do not prove server enforcement)
New files: `tests/outcome.test.ts` (13), `tests/pagination.test.ts` (11), `tests/persistence.test.ts` (9), `tests/files.test.ts` (15), `tests/resident-api.test.ts` (13 — real supabase-js query builder against a scripted `fetch`). Covered: failure kinds, schema drift, missing counts, cancellation, double tap, lost replies (cancel, insert, upload), definite vs unknown outcomes, pages above the row cap, page-shift de-duplication, superseded-query races, stale rows on refresh failure, no load-more loop, draft scope isolation, guest refusal, Keychain write failure without plaintext, interrupted write purge, failed-removal retry, cache tenant/environment/version isolation, corrupt cache, actual-byte type/size rules, metadata removal, owned paths, signed-preview expiry, orphan cleanup split, iOS permission mapping. Shared: 1 new iOS/Android/web wording test.

## 3. Verification after the change

| Check | Result vs baseline |
|---|---|
| iOS `npm run typecheck` | exit 0 (same) |
| iOS `npm run lint` | exit 0, no warnings (same) |
| iOS `npm test` | 74/74 passed, 9 files (baseline 13/13) |
| iOS `npx expo export --platform ios` | exit 0, 1,481 modules |
| `npx expo config --type introspect` | only `NSLocationWhenInUseUsageDescription` added; no Always/motion/background keys |
| `packages/shared` vitest | 420/420 (baseline 419 + 1 new) |
| Android `tsc --noEmit`, resident-web `tsc --noEmit` | clean (shared type widened compatibly) |
| `npx expo install --check` | exit 1 as at baseline; drift list now also names `expo-file-system` (57.0.2 → ~57.0.7) and `expo-location` (57.0.8 → ~57.0.21), the Android-resolved hoisted versions — joins owner decision P01-D04 |
| `npm run check:release` | exit 1, unchanged missing owner config/closed gates (expected) |
| Hosted read-only HEAD checks (public key, nil tenant) | all nine new column projections and the quoted `or` search filters return HTTP 200; a nonexistent-column control returns 400 |
| Root lockfile | semantic diff vs pre-change snapshot: only the iOS workspace entry gained the two dependency declarations; no package version changed |

Not run (blocked): any signed build, device Keychain/reinstall/native-error behaviour, Files/iCloud picker, location permission/reduced accuracy/Allow Once on device, realtime on device, app start against a tenant (PR-18).

Side effect noted: the first `npm install` in this session removed 8 `node_modules` entries that were not in the lockfile; `npm ls` afterwards shows no missing declared dependency (only pre-existing extraneous wasm binaries and the pre-existing `ajv` peer-range warning).

## 4. Task status

| Task | Status | Remaining |
|---|---|---|
| P02-T01 | Implemented–unverified (partial B coverage) | Adapters for B01–B03, B05, B08–B11, B14, B15, B17–B20, B22 arrive with their owning phases (table above); server enforcement P03 |
| P02-T02 | Implemented–unverified | Device lifecycle/interruption proof (signed build) |
| P02-T03 | Implemented–unverified | Realtime on device; escaped-wildcard search semantics against real data (syntax verified only) |
| P02-T04 | Blocked — pending manual verification | Keychain native errors, locked device, reinstall and logout-offline proof need a signed build |
| P02-T05 | Partial; device proof blocked | HEIC conversion deferred to the Photos-picker phase by OD-05 (P02-D02); server-side orphan cleanup for `request-attachments`/`id-documents` (P02-D10 → P03-T07); Files/iCloud proof needs a signed build |
| P02-T06 | Implemented–unverified | Device permission/reduced accuracy/Allow Once/Settings return proof |
| P02-T07 | Implemented–unverified (partial) | Bundled fallback content (A51-018) needs approved content (P13, G07); server content version (no `updated_at`/version column on `emergency_information`) → P03/P13 |
| P02-T08 | Verified (automated client/controller scope) | Server enforcement closes in Phase 3; device fault fixtures with the signed build |

## 5. Decisions

| ID | Decision | Reason |
|---|---|---|
| P02-D01 | Detail reads return `null` for a malformed id (screen shows its not-found state) without querying; writes still reject it. | Untrusted route input must not reach a query or show a raw validation error. |
| P02-D02 | No HEIC conversion in Phase 2. The Files picker filters by UTType (JPEG/PNG/WebP/PDF), so HEIC cannot be chosen; bytes sniffed as HEIF are refused with an explanation. Conversion needs a new native dependency (`expo-image-manipulator`) and belongs with the Photos-library picker in its owning phase (P05/P12). | No HEIC input path exists yet; adding an unverifiable native dependency without a consumer is bloat. Owner approved 2026-10-14 (OD-05, choice "A"). |
| P02-D03 | Metadata is removed by container editing in TypeScript, not by re-encoding; JPEG Orientation is re-emitted alone. | Testable without a device, keeps pixels lossless, keeps portrait photos upright. |
| P02-D04 | Cache policies: emergency content stale 24 h / expired 30 d; centers stale 30 min (Android TTL) / expired 24 h. | Operational facts must not look current; owner/DRRM review requested under G07. |
| P02-D05 | Search moved server-side (documents: name/description; drives: title/location/type label/ISO date); drive search adds location matching. | Incremental pages make client-side filtering of loaded rows give false "no results". |
| P02-D06 | Resident information excludes emergency sections server-side (`section not ilike %emergency%`). | Same meaning as the previous client filter, correct across pages. |
| P02-D07 | Emergency screen reads `emergency_information` (B13), not `site_content`, still behind the closed gate. | B13 is the authoritative emergency contract. |
| P02-D08 | Removed unused `household` and `registrations` adapters. | No caller; `household` contradicted OD-02 B04. |
| P02-D09 | Accept postgrest-js automatic retry of idempotent reads (max 3, 1/2/4 s); writes are never retried. | Library behaviour verified in source; consistent with the no-blind-write-retry rule. |
| P02-D10 | Client orphan cleanup only for `incident-photos`/`profile-photos`; `request-attachments` and `id-documents` have no resident delete policy (0095, 0096), so cleanup returns them as `serverCleanupRequired` → P03-T07. | Do not weaken storage policies; keep the omission observable. |

## 6. OD-06 amendment (2026-10-14)

Owner decision OD-06 ("skip sign builds for the whole plan", supersedes OD-04) removes signed builds and physical-device runs from every phase. Rechecked the same day before re-marking: iOS typecheck exit 0, lint exit 0, tests 74/74. Under the plan §1 OD-06 rule all eight tasks are **Verified (non-device scope, OD-06)**; the phase is Verified (non-device scope). Skipped (never counted as evidence): Keychain native-error/locked-device/reinstall/offline-logout proofs, Files/iCloud picker on device, on-device location permission/reduced accuracy/Allow Once, realtime on device. Split contributions stay with their owners: remaining B adapters (owning phases), HEIC conversion (P05/P12, OD-05), server orphan cleanup (P03-T07, P02-D10), bundled emergency fallback content and server content version (P13/P03). The task table in §4 is the pre-OD-06 record and is kept for history.

## 7. Blockers and remaining work (pre-OD-06, historical)
- Signed development build (OD-04; PR-02/PR-03/PR-04/PR-05/PR-18) blocks every device proof: Keychain/reinstall/native error, Files/iCloud, location permissions, realtime on device.
- P01-D04 now also covers `expo-file-system`/`expo-location` patch drift (hoisted, shared with Android).
- Out of scope, noted only: `health/register/[id].tsx` renders an empty screen when the drive is unavailable (P16); `createRequest` direct insert remains until P08; `packages/shared` `tsc -p .` reports `FileReader` errors in `id-evidence.ts` (uncommitted user work, not touched here).
