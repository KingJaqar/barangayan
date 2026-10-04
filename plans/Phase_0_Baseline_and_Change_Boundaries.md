# Phase 0 — Baseline and change boundaries

Scope: **Phase 0 only** of `Major_Web_AndroidMobile_Improvement_Plan.md`. The entire plan was read: expected outcomes, confirmed decisions, specifications A–I, dependencies and gates for phases 0–9, verification requirements, manual setup and release controls. Feature/schema changes start in Phase 1. No deployment, publication, production data changes, provider transactions or package installation was performed.

The baseline began September 30, 2026 (Asia/Manila) and continued October 1. Evidence timestamps are UTC. Candidate: HEAD `fb49ecd937c8ceaa6263521f40f84fae05bfe621`, plus the recorded dirty working tree. Environment: Windows, Node 24.13.1, npm 11.8.0, installed Next.js 16.3.0 and Expo 57.0.10. This report was restored after interruption; the original command evidence remains intact.

## Phase 0 action and exit-gate mapping

| Assigned action / condition | Implementation | Supporting verification |
|---|---|---|
| Review repository guidance and version-specific docs | Read root and both web AGENTS files; exact SDK 57 and installed Next guides | Documentation ledger below |
| Inventory affected UI and backend paths | Review primary, direct-link, legacy, iOS and admin correction journeys; index every application/shared/backend source/config file | Journey inventory; [source-inventory.md](evidence/phase0/source-inventory.md) and [source-index.json](evidence/phase0/source-index.json) |
| Inspect policies, triggers, storage, payments, provisioning, SLA | Follow migration replacement order and actual callers, including raw table writes and privileged functions | Backend findings below; 305 indexed SQL declarations |
| Record baseline tests/types/lint/builds | Run existing suites and workspace commands, export mobile bundles, probe backend/device prerequisites | Exact command/cwd/start/end/exit/log in `evidence/phase0/*/results.json` |
| Preserve existing work and identify pre-existing failures | Hash four original changed/untracked files; preserve migration diff; distinguish environment/cache/tool failures | `initial/preservation.json`, per-run `preservation-after.json`, `initial/existing-migration.diff`; repeat diagnostics |
| Requirement-to-verification checklist | Map all specifications and release constraints to phase owners and verification scenarios | 30 checklist groups below |
| Exit: every affected path identified | Manual journey closure plus exhaustive source/call/SQL/UI indexes | 758 source/config files, 2,864 line references; four platform consumers and all Android interaction surfaces |
| Exit: relevant baseline failures reproducible | Repeat persistent diagnostics; retain transient/incomplete attempts with honest classification | Baseline ledger; [gate.json](evidence/phase0/gate.json), [verification.log](evidence/phase0/verification.log) |

The automated gate verifies evidence integrity and mappings. Semantic completeness comes from the reviewed journeys and backend findings, not regex matches alone. A failing baseline does not prevent Phase 0 completion when its failures and limitations are recorded and reproducible.

## Guidance and prerequisites

- Root `AGENTS.md` requires the exact [Expo SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/). Reviewed that reference and SDK 57 [WebBrowser](https://docs.expo.dev/versions/v57.0.0/sdk/webbrowser/), [Location](https://docs.expo.dev/versions/v57.0.0/sdk/location/) and [DocumentPicker](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/) documentation. Future OAuth work must handle cancellation/dismissal and scheme callbacks; location/upload behavior must use these versioned APIs. A JS export is not native build qualification.
- Both web `AGENTS.md` files require installed Next documentation. Read the hoisted `node_modules/next/dist/docs/01-app/02-guides/data-security.md`, build/type-generation sections of `building.md`, and `01-app/01-getting-started/16-proxy.md`. Actions require independent authentication/authorization; Proxy refresh is not the authorization boundary. Builds regenerate route types. Retain existing cookie clients and Proxy behavior.
- Used Supabase security guidance and official [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [Google OAuth](https://supabase.com/docs/guides/auth/social-login/auth-google) documentation. The Markdown changelog endpoint failed; the [HTML changelog](https://supabase.com/changelog) was reviewed. Actual hosted patch versions, applied policies and Data API grants are unverified. Local config declares Postgres 17.
- Phase 0 has no previous phase prerequisite. Existing iOS scaffolding and migrations 0093/0094 are **source**, not proof of deployment or earlier-phase completion. The separate iOS implementation plan and unchecked release checklist record missing qualification; all 13 `apps/resident-ios-mobile/src/lib/release-gates.ts` gates remain closed.
- Supabase CLI, Docker, psql and Deno are unavailable. adb is unavailable inside the sandbox but works outside it and lists no connected devices. There is no accessible isolated database, emulator/device or signed-build evidence. No linked/production database was substituted.
- The supplied charter PDF exists and its original hash is preserved. Phase 3 must verify transcription against pages 4–6: four services, eleven categories, Simple/G2C, grouped procedures, 15-minute total, uncertain fees in assessment mode, and explicitly blank Certified True Copy personnel. No source information should be invented.

Confirmed decisions govern future work: advisory registration location checks; supporting uploads; in-person appearance; administrator fee clarification; browser OAuth on Android; administrator-only scores; agency time excluding only documented resident waits; preserve historical requests/payments/IDs/applicant numbers/scores; Ampid 1 configuration with tenant separation; iOS compatibility only.

## Preservation and phase boundaries

Only Phase 0 documentation, evidence and local collection/index/verification scripts were added. Scripts refuse to overwrite previous results, do not install dependencies, do not use `--linked`, do not reset databases or deploy. Their optional database test command uses the default local stack if available. The source index excludes dependencies and generated/native output.

The original four files are byte-for-byte protected: migration 0094's `{PP}` comment edit, `.claude/settings.local.json`, the supplied charter PDF and the complete improvement plan. Application source, migration SQL, package lock and release gates were not edited. Build commands may regenerate ignored `.next`, `.expo`, `dist/phase0-*` and type caches; such generated-state changes are distinguished from source changes.

## Affected journey inventory

Paths below are repository-relative. The generated inventory supplies exact file and line references for all affected reads/writes and additional consumers. Every literal `.from`, `.rpc` and `.invoke` call is indexed, including those outside the named groups. Dynamic calls still require manual review.

### Catalog and submission: A, B, C, D

| Surface | Entry points / consumers | Current backend path |
|---|---|---|
| Resident web catalog | `apps/resident-web/src/app/(resident)/services/page.tsx`, `documents/page.tsx`, `[documentId]/page.tsx`; `components/services/documents-list.tsx` | Reads current document types/fee/hour target/requirements under guest or tenant RLS; full charter model absent |
| Web request drawer | `components/services/document-request-modal/` shell and details/form/payment/pickup/QR/success steps | Shared schema, optional ID upload, direct request insert, payment-method RPC, attempted pickup insert or payment Edge Function |
| Standalone resident web submission | `app/(resident)/services/requests/new/[documentId]/page.tsx` and `new-request-form.tsx` | Separate validation/upload/direct insert; accessible URL must share future eligibility transaction |
| Android | `apps/resident-android-mobile/src/app/(app)/services/index.tsx`, `[documentId].tsx`, `request/[documentId].tsx`; document-list component | Catalog/doc read; shared validation, ID upload, direct request insert |
| Legacy resident portal within admin web | `apps/admin-web/src/app/resident/requests/new/page.tsx`, `new-request-form.tsx` | Still reachable; shared request schema and direct insert; must be included in compatibility/submission changes |
| iOS | `apps/resident-ios-mobile/src/app/(tabs)/services/`, `app/services/request/[id].tsx`, `src/data/resident-api.ts` | Tenant/active/deleted catalog filters; direct insert with client UUID and lost-response reconciliation; separate retries generate new UUIDs |
| Administrator catalog | `apps/admin-web/src/app/(admin)/services/` page/form/row/catalog | Shared document schema; table inserts/edits, activation and soft deletion |
| Administrator requests | `app/(admin)/requests/` table/detail; `components/admin/request-status-actions.tsx` | Guided RPCs plus raw status/payment status/resident/doc/date edits, manual inserts and soft deletion |

Shared contracts: `packages/shared/src/types/database.ts`, `types/domain.ts`, `schemas/request-form.ts`, `schemas/document-type.ts`, `schemas/payment.ts` and `index.ts`. Current request validation is UUID, optional notes ≤1,000 and appointment slot. Purpose is conflated with notes; dropdowns, conditional structured requirements, appearance state, approved submission reference and transactional idempotency are absent. Catalog model is description, fixed centavos, integer hours and string requirements. Seed/shared demo catalog contains three legacy services, not four charter services. Retain equivalent identifiers/history and additive compatibility before removing contracts.

### ID, profile, registration, locality and auth: C, F, G

- Web auth: `apps/resident-web/src/app/(auth)/register/register-form.tsx`, login, forgot-password, verify-OTP, reset-password and onboarding routes. Registration uses password, a selected barangay and optional browser GPS/client polygon check sent in signup metadata. There is no Google OAuth, code-exchange callback or mandatory Google profile-completion flow.
- Android auth: `src/app/(auth)/` register/login/recovery/auth-choice, `src/app/_layout.tsx`, `src/hooks/use-auth.tsx`, `src/lib/supabase.ts` and `app.json` scheme. Preserve recovery/register/guest guards and password behavior. No `signInWithOAuth` or `exchangeCodeForSession` implementation was found.
- Shared auth: `schemas/auth.ts`, `lib/supabase-client.ts`; both web `lib/supabase/{client,server}.ts`, `proxy.ts`; resident web `lib/auth/{require-user,get-optional-user,login-destination}.ts`. Retain cookie refresh and safe internal destinations for new callbacks. Authentication alone does not establish ID approval.
- Web profile: `app/(resident)/settings/profile/` page/form, `hooks/use-profile.ts`, `actions/id-document-signed-url.ts`, `lib/image-upload.ts`. Profile updates are direct; ID save has its own section, fixed front/back upsert paths and pending reset. Signed-URL action explicitly checks owner path. City remains editable; province absent.
- Android profile/cache: `app/(app)/settings/{profile,index}.tsx`, `hooks/use-profile.ts`, `hooks/use-auth.tsx`, `lib/{emergency-cache,supabase}.ts`; shared `constants/id-verification.ts` path convention. Profile IDs use front/back upsert; pending reset is application-side. Cache key `resident_profile` is global, cache loading has no user check and logout does not clear it. Delayed account responses and foreground/Services refresh need coverage.
- Administrator profile/ID: `app/(admin)/residents/` directory/types/page, `app/api/admin/residents/route.ts`, household/resident consumers. Modal buttons and editable cells write verification status; ID type can change independently. No reviewed evidence version, reviewer/time/rejection binding. Privileged admin provisioning must assign authorized resident/tenant identity.
- Legacy profile: `apps/admin-web/src/app/resident/profile/` still writes free-text name/address. Preserve safely unreconstructable history and composition compatibility.
- iOS: auth feature screens, profile/auth/register/recovery routes, `lib/{runtime,config,secure-storage}` and typed API. Its secure session lifecycle differs from Android; city is editable and ID changes gated off. Shared/backend changes require compatibility without enabling unrelated capabilities.

Provisioning chain: 0001 → 0012 → 0039 → 0068 → 0078 → **0081**, the latest `handle_new_user`. It requires registration name metadata and a valid metadata tenant. Google names without tenant metadata can fail provisioning; missing names skip provisioning. `compose_profile_display_fields` composes legacy display fields when structured data is supplied. Ownership policies permit broad profile insertion/update. 0056 guards **UPDATE-only** role escalation; no immutable tenant/fixed locality guard was found. Future controlled completion must derive permitted identity/role/tenant server-side and test direct profile insertion and tenant changes.

ID guard 0041/0089 prevents resident escalation to verified/failed but does not bind approval to images/type or reset on direct evidence changes. 0013 guards **email** verification, not evidence. Storage history: 0020 private ID bucket, 5 MB, owner-folder upload/read and same-tenant request-image admin read; 0042 public plus WebP and owner update/delete; 0073 private again; 0093 removes broad admin read and adds same-tenant **profile** evidence access. Owner update/delete still permits changing approved objects. Preserve legacy formats/images; introduce immutable versions and server reset/approval logic in Phases 1/2. Public avatars are a separate bucket. Private supporting-attachment storage is absent.

### Maps: F

Android `src/components/map-view.tsx` is a Leaflet **WebView**, with boundary/fit/picker bridge and out-of-bound drag/tap rejection. Consumers include Maps, Settings location verification, reports' picker/new/detail, and emergency map surfaces. Reuse `hooks/use-ampid1-boundary.ts`, shared `types/map-bridge.ts`, `lib/{point-in-polygon,geocode,haversine,osrm}.ts` and tests.

Web reuses Leaflet canvas/wrapper/fit/locate controls, report/emergency map wrappers and `app/(resident)/settings/location-verification/` map/form. Registration currently only observes browser GPS. Keep the advisory registration map separate from constrained Settings. Programmatic map positions/GPS may be assigned directly; UI rejection is not backend coordinate validation. 0078 registration observations and 0090/0091 selected location/address are separate profile fields with direct updates, no server range/polygon enforcement.

0024 and seed contain user-supplied Ampid 1 trace provenance; no official certification evidence. Seed `barangays.config` has no canonical locality defaults. Keep existing tenant UUID/history; do not infer missing house/street values.

### Payment and release: D

- Web standalone payment method/pickup/QR/success routes, equivalent drawer steps, Android `services/payment/` routes, request tracking controls, `hooks/use-paymongo-source.ts`, `constants/payment.ts` and Android `lib/payment-receipt-pdf.ts`. Current UI fee joins/props derive catalog values. Settlement flags remain unchanged; iOS pickup/QR gates stay closed.
- Administrator `src/lib/payments.ts` is reused by request actions and transaction table; refund component invokes refund endpoint. Collection updates an existing payment or creates one using current catalog fee. Inline financial edits, request detail, receipts and exports require request-level amounts/locking later.
- `create-payment-source` checks JWT user and ownership, paid/cancelled/completed/method state, resumes persisted QR, reconciles stale reservation, checks before/after reservation, and creates provider intent/method/QR with failure cleanup. 0093 unique temporary per-request `qrph_creation_key` helps serialization; it is not evidence of crash/retry correctness. Amount still comes from catalog.
- `check-payment-status` verifies owner, polls provider and can settle before webhook. `cancel-payment` authorizes owner, cancels provider intent and conditionally updates pending state. `refund-payment` checks administrator/tenant and uses recorded provider ID/refund state. Webhook HMAC/intent lookup preserves **legacy Sources** fallback, handles paid/failed/expired/refund events. Replay/order/provider/database faults remain untested; endpoints were not invoked.
- Payment policy/history: 0007/0009, **0017 removes resident INSERT**, 0064 sync/breakdown, 0065 intent fields, 0066 resume/cancel, 0082 pickup rename/shipping removal. Current resident pickup confirmations attempt prohibited inserts and ignore errors: source policy/consumer conflict, pending isolated database reproduction. Do not relax RLS to make them succeed.
- Guided RPCs: `begin_processing_request`, `mark_request_ready_for_pickup`, `complete_service_request`, `cancel_service_request`, `cancel_own_service_request`, `set_service_request_payment_method`. Preserve submitted/in_progress/ready_for_pickup/completed/cancelled. Admin raw edits/manual creation are additional paths; 0014 completion guard and history triggers must coexist with new independent review/assessment/SLA states. Historical amounts/provider IDs must not be recomputed.

### SLA and reporting: E

`packages/shared/src/lib/service-tracking.ts` measures submission-to-now using live hour targets, near target at 80%, overdue at **>=** target; completion time uses the first completed history entry. `computeDocumentTypeTrends` averages submission-to-completion. `lib/format.ts` provides shared progress/estimated date; `lib/request-status.ts` combines payment/processing display state. No acceptance/ready/release clock, assigned target/model snapshot, wait ledger, minute evaluator or alert deduplication exists. pg_cron 0077 is waste scoring, not SLA.

Consumers: resident web request list/drawer/detail/tracking and logs; Android request/log components and request detail; old resident portal list/detail; iOS requests/detail; administrator dashboard/request list/detail/exports. Dashboard sample selection uses **created_at**, not readiness/completion. History triggers 0002/0007 append status events; 0082 translates old delivery labels with history trigger disabled. Preserve recorded legacy timing models; new engine must share calculations across every consumer and use authoritative server events.

### Priority scores: H

`drive_registrations.priority_score` is on resident-readable own rows. 0035 resident RPC and 0072 admin RPC compute the weighted formula and return scores; drive locking/capacity, unique registration and applicant numbers must remain intact. 0094 guards tenant writes, not score privacy.

Exposed consumers: Android health inline form, standalone register and RegistrationDetailSheet (`app/(app)/health/{index,register}.tsx`), health hook; web applicant/registration/register drawers, hook and standalone/my-registrations routes; iOS wildcard reads and explicit score reconciliation in `resident-api.ts`; wildcard `export-my-data`; health realtime publication/subscribers. Removing displayed text is insufficient.

Administrator applicants table/modal/page, drive detail/ranking/exports, shared database/domain/schema/priority constants are compatibility boundaries. Phase 7 must reconcile protected values and deploy compatible consumers before removing score fields from resident REST/RPC/realtime/export responses.

### Android interaction audit: I

The source inventory lists **all** Android app routes/components: auth, Home, services, health, profile/settings, reports/announcements, maps, emergency/QR/check-in and navigation/sheets. Review primary button, text field/password toggle (44×44), tabs/header, chips/segments/search/settings/toggles, calendar/family/ID/upload controls, route-local Pressables and map WebView controls. Existing theme spacing does not enforce universal 48×48 targets or 56 primary height. Device measurement, TalkBack/focus, keyboard/safe areas, large text and themes are **unverified**, not inferred from styles.

## Authorization/read/write closure and conflicts

1. Resident REST request inserts enforce owner/request tenant but not related document tenant/active state, current ID evidence, requirements or forged initial status/payment state. No later service insertion guard exists; 0094 protects other tables. Phase 1 owns the authoritative boundary.
2. Profile INSERT/UPDATE/tenant/role assignment and evidence mutation require coherent server controls. Current fixed-path upserts can replace reviewed pixels before pending status save. Immutable evidence/storage and concurrent approval/submission are Phases 1/2.
3. Admin guided operations, editable table corrections/manual inserts and privileged routes are independent entry points. Security-definer functions need real auth/NULL handling, tenant checks, locks and execute grants, even if a page guard exists.
4. Private IDs, public avatars, report images and site assets are indexed. New private supporting files need owner/same-tenant admin access and protection against arbitrary file references; preserve existing profile-ID image rules.
5. Request/payment/profile/health realtime publications/listeners and wildcard exports are read boundaries. Scope refresh/caches to account and remove protected scores at payload level.
6. `export-my-data` reads profile, request/payment, incident, registration, check-in and push-token sections under caller JWT; score payload is affected. Account deletion clears ID/profile fields and must remain compatible with new historical evidence references. No broader privacy redesign was undertaken.
7. Current catalog-derived money/time differs from required assessment/snapshot semantics. Preserve legacy histories, Sources provider IDs, old amounts, approved images and applicants. Keep unclear charter fees in assessment; other tenant config unchanged.
8. Database versions/applied policies, native devices, Google/provider setup, fee/settlement confirmation and boundary certification are external prerequisites for later gates. Existing iOS missing packages and release gates are baseline blockers, not authorization to install/update or enable features in this phase.

## Requirement-to-verification checklist

Every row is **pending feature acceptance**. Phase 0 completes the mapping, not those later feature outcomes. Use two tenants, resident/admin/anon identities, representative historical data, deterministic server cases and meaningful post-state assertions.

| ID / phases | Requirement and verification |
|---|---|
| A1 / 1,3,4 | Four scoped services; equivalent IDs/deactivation/history: catalog SQL and before/after joins; other tenant unchanged; inactive direct insert/link fails |
| A2 / 3,4 | Eleven charter categories, exact wording/grouping/Simple/G2C/15 minutes and missing personnel: PDF pages 4–6 comparison, admin edit/read-back, Android/web drawer/detail screenshots |
| B1 / 1,4 | Required purpose, separate notes, Others trim/1,000 max, service-switch reset: schema boundaries 0/1/1,000/1,001/whitespace; each UI/backend path |
| B2 / 1,3,4 | Business+DTI, HOA/renter evidence, CTC record/copies, appearance: conditional schema/backend rejection and four resident→admin journeys; approval never substitutes for residency |
| B3 / 1,4 | Private JPG/PNG/WebP/PDF ≤5 MB, unchanged ID image rules: MIME/size boundaries, foreign/forged references, owner/admin/anon/other-tenant storage tests, failed-upload retry |
| B4 / 1,4 | Transactional identity/tenant/current approval/active service/idempotency: direct REST/RPC tampering, concurrent same-key attempts, lost-response retry yields one request |
| C1 / 2,4 | Four ID states, persistent warnings, blocked requests, Verify Now: direct links/DB denial, slow-load scroll and accessibility focus, Android/web states |
| C2 / 1,2,4 | Immutable versioned evidence and reviewed actor/time/reason/version/request reference: overwrite/delete/type reset, concurrent review/replacement/submission, stale approval, revocation preserves old requests |
| C3 / 2,4 | Approved reuse/preview, valid legacy evidence and repair flags: reconcile old signed images and history; missing/inconsistent approvals flagged |
| C4 / 2,4 | Unrelated edits preserve approval; account cache/logout/lifecycle refresh: account A→B/offline/delayed response, admin decisions and Services/foreground/profile refresh |
| D1 / 1,3,4 | Assessment/exemptions, CTC ₱10/confirmed total pages: persist basis/assessor/time; unknown amount blocks payment but permits submission; no double multiplication; waivers bypass payment |
| D2 / 1,4 | Request amounts drive creation/collection/receipts and freeze after start: catalog edit stability, unauthorized mutations, concurrency/locking, zero/unknown/waived/history |
| D3 / 4 | Financial retries/idempotency/history: concurrent QR creation, response loss, provider/database partial failure, expiry/resume, payment/cancel race, webhook replay/order/bad signature and refund retry in test mode |
| D4 / 3,4 | Separate requirement/ID/eligibility/fee/appearance/release decisions: guided RPC and raw correction paths, invalid/cross-tenant decisions fail, preserve status names |
| E1 / 1,5 | 15-minute target/model snapshots and legacy behavior: catalog changes, representative old data; no clock before complete requirements/appearance readiness |
| E2 / 5 | Agency acceptance→ready, separate release turnaround/waits: 11:59,12:00,15:00,15:01; internal delay counted, pause retains position, seconds exact/display rounding only |
| E3 / 5 | Pause reason/actor/start/resume, overlap/invalid/repeat rejection, cancellation freeze: DB transitions and concurrent pause/resume; canceled excluded from successful compliance |
| E4 / 5 | Minute evaluator/dedup/live displays/report windows: delayed/repeated evaluator, threshold alerts once; readiness sample selection and cross-consumer aggregate agreement |
| F1 / 1,2,6 | Fixed San Mateo/Ampid 1/Rizal from tenant config: UI read-only/grey, direct locality/tenant tampering fails; other tenant/legacy free-text preserved |
| F2 / 6 | Advisory boundary map/pan/zoom/detect/fit/confirm/home pin: inside/outside/edge, permission/GPS/network/missing-boundary failures; registration remains available; GPS separate |
| F3 / 1,6 | Server coordinate/polygon validation and constrained Settings/provenance: range/NaN/forged result/edges; outside Settings rejected; certification only with confirmation |
| G1 / 1,6 | Google buttons/PKCE/cookie/web+Android callbacks and password-free completion: new/existing/linking/missing metadata; server resident tenant, safe redirects/code exchange |
| G2 / 6 | OAuth failures/lifecycle and ID separation: cancel/provider/network/expiry/replay/repeated taps, warm/cold/restart/persistence, incomplete profile and unverified requests; password recovery regression |
| G3 / 6,9 | Environment setup/development/signed scheme: Google Web client/origins/provider/Supabase callback/exact redirects for local/staging/production; signed-device proof; no unnecessary native client |
| H1 / 1,7 | Preserve protected scores/formula/applicants/capacity/admin ranking/export: value/count reconciliation; resident REST/RPC/realtime/export denial and same/other-tenant admin tests |
| H2 / 7,9 | All UI/accessibility/shared/legacy/iOS privacy compatibility: searches and payload assertions; consumer rollout before obsolete fields removed |
| I1 / 8 | 48×48 targets, 56 primary height, 8 spacing, 16 padding: measured audit of every indexed Android route/primitive/WebView, including overlapping hitSlop |
| I2 / 8 | Reachability/destructive separation/keyboard/safe area/large text/TalkBack/themes/small screens: recorded device matrix; no clipping/hidden primary actions/overlap |
| R1 / 1–9 | History/tenant/additive migration compatibility: empty and representative existing isolated DB rehearsals; requests/payments/IDs/scores reconcile; legacy/iOS consumers remain readable |
| R2 / 9 | Release/recovery controls: staging-qualified setup/full journeys, forward security fixes, idempotent financial recovery, no secret/ID logging; external boundary/fee confirmation remains required |

## Baseline results and reproduction

Raw evidence is authoritative. `initial`: first sandbox run; `unrestricted`: actual tests/builds after tooling restrictions; `mobile-lint`: actual mobile diagnostics; `recheck`: persistent failures/generated-type recovery; `prerequisites` and `failure-repeat`: SDK/backend reproduction; `root-lint-stream`: completed root check with full compressed output. Result metadata records exact commands, directories, timestamps and exits. CI and telemetry-off flags apply; SDK checks are offline/read-only. No validation/types/tests/authorization were weakened.

| Check | Actual result and evidence |
|---|---|
| Shared unit tests | PASS, 12 files / 93 tests (`unrestricted/shared-tests.log`); first esbuild parent-directory permission failure was environmental |
| iOS unit tests | PASS, 2 files / 8 tests (`unrestricted/ios-tests.log`); unit logic does not prove native SDK installation |
| Shared, admin-web, Android types | PASS (`initial` logs and zero exits) |
| Resident-web types | Initial TS2344/TS2307 generated `.next` failure; PASS after successful build regeneration (`recheck/resident-web-types.log`), no source/config suppression |
| iOS types | FAIL reproduced: missing `expo-crypto`, `expo-secure-store` (`initial`, `recheck` TS2307) |
| Web lint | Both workspaces PASS (`initial`, `unrestricted`) |
| Android lint | PASS (`mobile-lint`); initial resolver EPERM was sandbox-only |
| iOS lint | FAIL reproduced outside sandbox: two unresolved SDK modules (`mobile-lint`, `failure-repeat`) |
| Web production builds | Both PASS (`unrestricted` and initial build logs), TypeScript included; no authenticated E2E conclusion |
| Android JS production export | PASS, Hermes bundle/metadata into ignored `dist/phase0-android`; not native build qualification |
| iOS JS export | FAIL reproduced: `expo-secure-store` plugin unavailable (`initial`, `unrestricted`, `recheck`) |
| iOS release preflight | FAIL reproduced: six missing process config values and 13 closed gates (`initial`, `recheck`). Preflight does not load `.env`; export loading is separate |
| Android SDK compatibility | FAIL reproduced: installed view-shot 5.1.1 vs offline expected 5.1.0; advisory validation, export passes (`prerequisites`, `failure-repeat`) |
| iOS SDK compatibility | FAIL reproduced: declared `expo-crypto` not installed (`prerequisites`, `failure-repeat`) |
| Root lint | FAIL, completed exit 1: 79,088 errors / 34,634 warnings. Includes generated `.next` bundles and Deno URL-import resolver errors. Full lossless `root-lint-stream/root-lint.log.gz`; readable excerpt `.log`. First run's build collision (ENOENT) and buffered repeat's ENOBUFS are incomplete attempts, separately recorded |
| Database/migration/RLS/storage/concurrency | BLOCKED: absent CLI/Docker/psql; attempted `supabase test db` records command unavailable. SQL reviewed: 17 isolation + 7 tenant/household assertions, **no executed database proof** |
| Edge Function types/runtime | BLOCKED: absent Deno; attempted check recorded; endpoints not invoked |
| Native/device/E2E/accessibility | UNVERIFIED: adb outside sandbox lists no device; no signed builds/device qualification. No implemented web/Android E2E harness or iOS E2E directory found |
| Phase 0 script checks | Node syntax and scoped ESLint PASS; integrity/mapping/preservation gate passes |

Persistent diagnostics are reproduced in two independent records. Sandbox restrictions are resolved by authorized local checks outside the sandbox. Resident-web stale generated types recovered through the normal build; they are not mislabeled persistent source errors. Source findings about policy, immutability, money/time and privacy remain pending runtime proof.

```powershell
node scripts/phase0-inventory.cjs
node scripts/phase0-baseline.cjs plans/evidence/phase0/new-run
node scripts/phase0-baseline.cjs plans/evidence/phase0/new-ios-run ios-types ios-lint ios-export ios-release
node scripts/phase0-baseline.cjs plans/evidence/phase0/new-sdk-run android-sdk ios-sdk
node scripts/phase0-verify.cjs
```

Use a new output directory for each run. Run dependency tooling outside parent-directory restrictions when necessary. Avoid builds concurrent with root lint because root configuration includes generated output. For database tests, provision an **isolated local** Supabase/Docker stack; do not use production. Before later native/provider gates, supply installed iOS dependencies, configuration, devices/signing and staging/test-mode provider evidence. No package or release-gate repair is claimed in Phase 0.

## Exit verdict

**Complete for Phase 0**, subject to the current [gate.json](evidence/phase0/gate.json) and [verification.log](evidence/phase0/verification.log): affected-path inventory and 30 requirement mappings exist; persistent failures reproduce; transient/blocked checks are explicit; original user files remain unchanged and the only tracked diff is the original migration comment. This is a baseline/change-boundary verdict, not later feature, database security or release acceptance. All pending feature acceptance, external setup and unverified journeys remain visible. No subsequent phase was implemented.
