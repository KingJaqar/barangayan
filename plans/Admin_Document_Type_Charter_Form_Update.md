# Administrator document type charter form update

Verdict: **complete locally**, October 4, 2026. Production deployment and production database changes were not requested or performed.

## Scope and grounding

The latest request replaces the restored legacy creation form with full Citizen’s Charter create/edit behavior. The full implementation plan, applicable AGENTS, existing form/catalog and resident consumers, migrations 0095–0100, shared contracts and tests were inspected. Exact Expo SDK 57 and installed Next 16.3 documentation were consulted before code changes. Existing uncommitted earlier-phase work was retained. Supabase and React review guidance were applied.

One `DocumentTypeForm` implements creation and editing for both existing formats. `ServiceCatalogEditor` provides all-field viewing, editing, activation and recoverable archiving. The Services SLA shortcut remains removed. No dependency was added.

## Completed requirement checklist

All rows use the same create/edit controls and shared validation. The browser fixture deliberately uses distinct procedure prose, minute target, published fee guidance, and charging configuration.

| Field | Existing persistence / implementation | Verification and result |
|---|---|---|
| Name | `name`, trimmed required text, maximum 200 | Create/reload and edit/reload PASS |
| Description | `description`, optional text, maximum 2000 | Create/reload and edit/reload PASS |
| Office/Division | `charter.officeDivision`, multiline required text | Both persistence paths PASS |
| Classification | `charter.classification`, editable required text, maximum 200 | Complex and updated value persist; whitespace rejected |
| Type of Transaction | `charter.transactionType`, editable required text, maximum 200 | G2B and updated value persist |
| Who May Avail | `charter.whoMayAvail` | Both persistence paths PASS |
| Checklist of Requirements | `charter.checklistOfRequirements`; derive `requirements` mirror from its nonempty lines | Both paths and stored mirror PASS; no duplicate input |
| Where to Secure Requirements | `charter.whereToSecureRequirements` | Both persistence paths PASS |
| Client Steps | `charter.clientSteps`, multiline procedure prose | Both persistence paths PASS |
| Agency Actions | `charter.agencyActions`, multiline procedure prose | Both persistence paths PASS |
| Fees to Be Paid | `charter.feesToBePaid`, published guidance | Persists independently from fixed and assessment pricing |
| Processing Time | `charter.processingTime`, procedure durations as prose | Persists independently from 25/35-minute SLA targets |
| Person Responsible | `charter.personResponsible`, nullable when unspecified | Entered values persist; existing unspecified CTC source remains supported |
| Processing Target | `processing_target_minutes`, positive whole minutes | 25 then 35 persist; submitted request snapshots 35 |
| Purposes | Existing `purposes` JSON, stable codes, editable labels/explanation flags, 1–30 entries | Labels and true→false explanation edits persist |
| Supporting Requirement Rules | Existing `requirement_rules` JSON; workflow-compatible attachment and appearance checkboxes | Appearance true→false persists; incompatible DTI rule rejected; prior specialized-service suites pass |
| Pricing | `pricing_mode` plus `fee_centavos`; fixed PHP input, assessment/exemption, supported CTC page pricing | Fixed ₱25.50 persists; assessment edit persists with no invented charge; prior assessment/per-page suites pass |

| Cross-cutting requirement / gate | Implementation and evidence |
|---|---|
| Validation and state handling | Shared and database validation; required/length/range controls; readable field errors, busy fieldsets/buttons, success toast and recovery. Real invalid classification rejected and corrected save succeeded. Catalog loading errors expose Retry instead of an empty catalog; missing sessions redirect safely |
| Duplicate submissions / interrupted reply | Per-form busy guard, stable UUID across create retries, saved-row reconciliation after a lost response; failed/zero-row updates remain errors. Resident submission retry tested against the newly created general service returns the same request |
| Administrator and barangay isolation | Existing tenant/admin RLS retained, updates filter document and barangay IDs. SQL resident update affects zero rows; foreign tenant cannot read; previous creation and RLS suites pass |
| Historical compatibility | Editing a legacy catalog upgrades future requests only; old request contract, timing, target and timestamp remain. Snapshot missing legacy fees using the old catalog amount before enrichment. Recorded fee remains immutable. Existing seven-table history and other-tenant fixtures reconcile |
| Schema reuse | 0101 adds no duplicate data columns. Extend service-kind constraint and retain uniqueness for four specialized workflows while allowing multiple general services; update existing validation guards without removing controlled request/payment protections |
| Consumer compatibility | General service uses existing common resident form/purpose and appearance validation, no specialized fields. Real authenticated resident submission succeeds and snapshots configured target/pricing. Shared tests, all affected types, both web builds and Android Hermes export pass |
| Final review | One create/edit implementation replaces obsolete legacy editor; archive retained; no unrelated refactor or dependency. Final whitespace check and affected lint pass |

## Actual verification evidence

- Eight local SQL suites, **316 assertions PASS**, including **41 new charter assertions**: `evidence/phase2/local/test-1791077656750.log`. Earlier failed resident-update assertion expected an exception; RLS correctly affected zero rows. The corrected test asserts the empty returned row set, without changing the policy.
- **142 shared tests PASS**, shared typing PASS: `evidence/document-charter/final-checks/results.json`.
- Resident web/admin/Android typechecks and resident web/Android lint PASS, resident production build and Android production Hermes export PASS: `evidence/document-charter/checks/results.json`. Its initial shared typing failure was an incomplete test-row fixture, repaired with a fully typed row and rerun above.
- Final administrator typecheck and production build PASS: `evidence/document-charter/admin-final/results.json`. That run’s lint found generated preview files; generalized the existing preview exclusion, then administrator lint PASS: `evidence/document-charter/lint-final/results.json`. Source lint and acceptance rules were not disabled. Scoped changed shared-module and verification-script lint also pass.
- Empty and representative existing database migration replay through **0101 PASS**, including historical and other-tenant reconciliation: `evidence/phase3/charter-final-rehearsal-3/results.json`. Earlier rehearsal attempt found the local server stopped; the existing disposable server was restarted.
- Real browser validation, create/save/view/reload/edit/save/reload: `evidence/document-charter/browser-values.json`, `saved-charter.png`. **47 browser/database/resident assertions PASS**: `evidence/document-charter/persistence-audit.json`, verified by `scripts/document-charter-audit.cjs`. No browser errors after the CSS correction.

Browser verification reproduced the original CSS parsing error because additive `@source` declarations still allowed automatic scans into generated caches. Tailwind’s documented `source(none)` plus explicit application/shared sources corrects it; the final live screen and production build pass. Reference: [Tailwind source discovery](https://tailwindcss.com/docs/detecting-classes-in-source-files).

Root-wide lint and iOS prerequisites have separately recorded pre-existing failures in Phase 0/5; this request’s affected workspace checks pass. iOS remains outside the Android/web improvement scope.

## Decisions and release setup

- New ordinary document types default to **general service**; administrators select specialized workflows only when applicable. Existing version-two workflow identities remain fixed because historical resident requests depend on them. Classification and transaction type remain fully editable; original four seeds retain their source values.
- Completing an older catalog entry requires administrators to supply its missing charter content. Existing hour targets are retained for historical consumers; future version-two requests use the explicit minute target. No historical request is relabeled as a new charter request.
- All published fees remain prose. Staff assessment stores no confirmed fee until assessment; fixed pricing stores centavos, and existing CTC page pricing remains ₱10 per confirmed billable page.
- Apply pending migrations in order through **0100 then 0101**, after their 0095–0099 prerequisites, with compatible web/Android consumers during an authorized release. These migrations were applied only to disposable local databases. No production release is claimed.
- Windows-to-WSL loopback forwarding became unavailable during verification. Automatic approval review rejected a temporary relay; no relay was created. The isolated preview instead used the direct private local test address through a constrained launcher option. This does not change production configuration.

Every requested field and persistence gate has supporting evidence. No implementation or local verification requirement remains unmet.
