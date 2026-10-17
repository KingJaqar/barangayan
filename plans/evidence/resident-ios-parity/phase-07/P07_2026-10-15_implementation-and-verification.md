# Phase 7 — implementation and verification record (2026-10-15)

Paired documents: `plans/Resident_iOS_Implementation_Plan.md` Revision 1.5 and `plans/Resident_iOS_UI_UX_Design_System_Handoff.md` Revision 2.1 (D05, DX09, DX10, §11 D05–D08 composition).
Source revision: base `e860743` plus uncommitted work. Environment: Windows host, iOS workspace `apps/resident-ios-mobile`. No signed build, no app launch, no live backend run (OD-06, OD-07). Nothing committed, deployed or applied remotely.

## Scope

Services catalogue discovery and service detail: P07-T01…T06 (A09, A10; D05). Apply/form (Phase 8) and Requests/Logs content (Phase 9) are not part of this phase.

## Entry check

| Dependency | State found | Effect |
|---|---|---|
| Phase 2 | Verified (non-device) | Paged list, `useResource`, realtime and boundary parsing reused unchanged. |
| Phases 3–6 | Partially complete; exits carried as blockers | Owner gave the explicit go-ahead on 2026-10-15 (plan "Entry status"). |
| B06 hosted contract (read-only) | `document_types` has `contract_version`, `service_kind`, `charter`, `purposes`, `requirement_rules`, `pricing_mode`, `processing_target_minutes`; 4 active rows, all version 2, none with null charter/purposes; select policies for anon, resident and incomplete-profile accounts present | No migration needed. |
| G04 required-ID gate | Closed (`releaseGates.privateIdUploads = false`) | Remediation routes to the ID screen; its upload stays gated. |

Hosted checks were information-schema, policy and aggregate-count reads only; no row content was read.

## Requirement classification (before editing)

| Requirement | Found | Action |
|---|---|---|
| Catalogue list with server search | Done in baseline (Phase 2) but selected only six columns and rendered `fee_centavos`/`processing_target_hours` for every service | Extended columns; labels now per contract version. |
| Documents/Requests/Logs entry | Single list plus a "My requests" link | Segmented Documents/Requests; Logs deferred (P09-T05). |
| Eleven charter fields, purposes, rules | Not started | Built. |
| Apply/verification/profile remediation | Detail showed "Request this document" for any signed-in resident | Built `applyState`. |
| Realtime/refresh | List done; detail not subscribed | Detail subscribes to its own row. |
| ID/profile status on Services (A09-018…021) | Not started | Built `ReadinessCard`. |

## Files

- `src/data/schemas.ts` — `documentRow` and `DOCUMENT_COLUMNS` gain the seven contract columns (loose on the jsonb columns).
- `src/features/services/catalog.ts` — pure model: `describeService`, `applyState`, labels, icons, `SERVICE_COPY`.
- `src/features/services/{documents-list,service-card,own-requests,readiness,readiness-card,document-detail}.tsx|ts` — screens and hooks.
- `src/app/(tabs)/services/{index,[id]}.tsx`, `src/app/requests.tsx` — thin routes.
- `src/components/ui.tsx` — `SearchField`, `Segmented`.
- `src/auth/pending-destination.ts` — `/services` and `/services/<uuid>` added to the public return allowlist.
- `tests/services.test.ts` (new), `tests/resident-api.test.ts`, `tests/auth-recovery.test.ts` (updated).

No new dependency, migration, shared-package or configuration change.

## Decisions

| ID | Decision | Reason |
|---|---|---|
| P07-D01 | `SearchField` and `Segmented` are built here, in `ui.tsx`. | Services is the first consumer; the Phase 6 hand-off table named Phase 11 for the segmented control only because Reports was assumed first. Phase 11 reuses it. |
| P07-D02 | A version-2 row is shown even when it fails the strict shared contract, but is not requestable ("being set up by your barangay"). Charter fields are read leniently per field. | One misconfigured service must not hide the catalogue; "missing configured values are explicit, never invented". The strict schema is the one Phase 8 will submit against. |
| P07-D03 | `contract_version` other than 1 or 2 is `unsupported`, not legacy. | A future contract must not open the legacy form. |
| P07-D04 | "Additional notes" (A10-006) is always expanded, not collapsible. | The accordion control is Phase 18's; the note carries a verification instruction and must not be collapsed away. |
| P07-D05 | Fee label is derived from `pricing_mode` plus the stored `fee_centavos`; the shared `servicePriceLabel` is not used. | It hard-codes ₱100.00/₱10.00 and prints "No payment required" for an assessed service with a zero fee, which would read as a free document. Business keeps the shared `BUSINESS_FEE_DESCRIPTION`. |
| P07-D06 | The processing label for version 2 does not use the shared `serviceProcessingLabel`. | It would print "null minutes". |
| P07-D07 | Guest "Log in to request" returns to the service detail, not straight into the form. | The detail then shows the profile/ID remediation the resident still needs. |
| P07-D08 | The Requests segment embeds the existing own-request list (moved to `features/services/own-requests.tsx`); `/requests` still works. | Avoids a second list; Phase 9 extends one component. |

## Baseline versus final

| Check | Baseline | Final |
|---|---|---|
| `tsc --noEmit` | 0 errors | 0 errors |
| `eslint .` | 0 problems | 0 problems |
| `vitest run` | 190 / 190 | 207 / 207 (17 new) |
| `expo export --platform ios` | not run at baseline | exit 0, 1 bundle |

## Acceptance status

| Criterion | Status |
|---|---|
| A09-001…004 segment switch (Documents/Requests) | Met (non-device). Logs: not met — P09-T05. |
| A09-005/006 search placeholder and a connected search box | Met (non-device): debounced server-side filter on name and description, clear action. |
| A09-007…013 active non-deleted catalogue, cards with name, icon, fee, processing, open detail | Met (non-device). |
| A09-014…017 loading, empty, error, retry | Met (non-device). |
| A09-018…020 ID verification status, Verify Now, retry the check | Met (non-device). |
| A09-021 shortcut back to Documents | Met: Documents is the default segment and the detail has "Back to Services". |
| A10-001…005, 007 name, description, fee, requirements, processing, originals guidance | Met (non-device). |
| A10-006 expand/collapse notes | Equivalent: always expanded (P07-D04). |
| A10-008…019 eleven charter fields | Met (non-device). |
| A10-020/021 request action / "Log in to request" | Met (non-device) with profile and ID remediation added. |
| A10-022…025 skeleton, not-found, retry, return | Met (non-device). |
| D05 inactive/deleted/foreign link, no invented fee | Met (non-device). |

## Pending manual verification (Skipped — OD-06/OD-07)

On a signed build against a configured backend (PR-03/PR-18 supplied): (1) open Services signed out and signed in; confirm only Documents shows when signed out; (2) type a term that matches and one that does not; confirm the results, "No matching services" and the Clear button; (3) open each of the four seeded services and confirm eleven titled sections; (4) edit and deactivate a catalogue row from the admin app while the list and its detail are open and confirm both update; (5) with an unapproved ID confirm "Verify now" and no request form; (6) at Accessibility XXL confirm the segment control stacks and no option is clipped; (7) VoiceOver: the segment tabs, cards and charter headings announce correctly.

## Out-of-scope observations

1. Hosted policy "anyone can read active document types" (anon) tests only `is_active = true`: no tenant or `deleted_at` predicate. The client filters both, but a direct REST read by a guest can return soft-deleted or other-tenant rows. Phase 3 domain.
2. `/services/request/[id]` (Phase 8 replaces it) is still the baseline notes-only direct insert; it does not honor purposes, rules or `submit_service_request`. Phase 7 routes to it only after the ID gate.
3. The services index no longer links "My requests and history" for a guest; the Requests segment is hidden for guests by design (A09, Android parity).
4. Two ID sources exist: the Phase 5 ID screen reads the newest `id_submissions` row, while Services uses the shared `idVerificationState(profile)` (profile columns, as Android and the database guard do). They agree when the profile is in sync; a divergence shows as "Verify now" until the profile refreshes.
