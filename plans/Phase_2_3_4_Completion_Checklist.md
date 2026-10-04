# Phases 2–4 completion checklist

Scope: execute Phase 2, verify its gate, then Phase 3 and its gate, then Phase 4. No production changes or later-phase rollout. Existing uncommitted Phase 1 and unrelated files are preserved.

## Phase 2 — verified complete

| Requirement | Work / affected journeys | Verification / expected result | Dependency / status |
|---|---|---|---|
| Immutable evidence and administrator review | Android and web profile uploads; administrator directory review; version publication/review RPCs | Uploaded versions cannot be overwritten; review uses displayed version; rejection/revocation records reason/reviewer/time; stale review fails | Phase 1 operations inspected; verified |
| Legacy approvals and repair | Reconcile existing evidence objects without inventing reviewer history; flag missing/inconsistent evidence | Representative database before/after comparison; valid approval retained; inconsistent verified rows blocked and visible for repair | Existing private Storage objects; verified |
| Approved object protection | Protect imported and new evidence paths; eliminate canonical-path upserts | SQL and actual Storage API overwrite/delete denial, cross-account/cross-tenant denial | Local Supabase runtime available; verified |
| Province and fixed locality | Profile displays configured read-only City/Barangay/Province; database enforcement and safe structured backfill | Tampering rejected; ordinary edits retain approval; legacy free-text/tenant IDs preserved; other tenants unchanged | barangay_localities; verified |
| Account-scoped cache | Android cache/logout/in-flight fetch isolation; web stale-fetch isolation; refresh after updates, review and foreground | Account switch/logout/offline/racing fetch tests; foreground/realtime refresh; UI review | Existing profile hooks; verified |
| Exit gate | All five rows integrated | Approval identifies evidence; replacement cannot retain approval; locality tampering and cross-account leakage fail | Verified — Phase 3 authorized to start |

Phase 2 row and gate evidence: `Phase_2_Trusted_ID_Evidence_and_Locality.md`. All five implementation rows and the gate are verified; the rows above are verified.

## Phase 3 — verified complete

| Requirement | Work / affected journeys | Verification / expected result | Dependency |
|---|---|---|---|
| Four services and charter | Source PDF pages 4–6; database configuration and eleven charter categories | Four exact services, Simple/G2C/15-minute total; blank CTC personnel explicit | Source PDF; Phase 2 gate |
| Catalog editing | Administrator service forms for charter, purposes, requirements and pricing | Save/reload valid catalog; invalid/foreign-tenant edits rejected | Shared catalog validator |
| Review/appearance/readiness | Administrator request details with private attachments and reviewed ID, requirement decisions, fee assessment, appearance and readiness | Each service decisions persist; incomplete/unpaid/appearance-not-ready paths blocked | Controlled backend operations |
| Superseded services/history | Reuse equivalent identifiers; deactivate others only in Ampid 1 | Historical request/payment references retained; other tenants identical | Migration reconciliation |
| Pricing | Assessment for unclear fees/exemptions; CTC total pages × ₱10; confirmed/waived amounts | Fee basis/assessor/time; no double copy multiplication; amount frozen after payment begins | Phase 1 assessment boundary |
| Exit gate | Every service review workflow and tenant isolation | Administrator UI and database integration evidence | Must pass before Phase 4 |

Phase 3 row and gate evidence: `Phase_3_Catalog_and_Administrator_Workflows.md`. All assigned rows and the exit gate are verified.

## Phase 4 — verified complete

| Requirement | Work / affected journeys | Verification / expected result | Dependency |
|---|---|---|---|
| Charter/forms/uploads/details | Android detail/request, web drawer/standalone, legacy accessible submission routes; shared conditional validation | All four services, Others trim/max, switching resets, DTI/HOA/renter/CTC/appearance, private ≤5 MB files; loading/error/retry | Phase 3 gate |
| Services verification and reuse | Persistent four-state warnings; Verify Now opens/focuses loaded Upload Valid ID; approved ID previews | Block unverified paths; verified evidence reused; server rechecks approval | Phase 2 |
| Shared submission | Every resident path uses transactional owner-scoped idempotency | Direct insert/forged identity/inactive/foreign files fail; concurrent/retry submits return one record | Phase 1 RPC |
| Payments | Pending assessment UI, confirmed request amount in provider/pickup/receipt paths, waivers, historical contract compatibility | Unknown amount denied; total-page arithmetic; stable amount; repeated taps/network retries preserve payment idempotency | Verified pickup/waiver UI and isolated provider-contract checks |
| Exit gate | Four complete Android/web assessment/payment journeys | Observable UI plus database/API authorization/concurrency and financial evidence | Verified on native Android and web; production provider handlers exercised with only provider HTTP stubbed |

Phase 4 row and gate evidence: `Phase_4_Resident_Document_Journey_and_Payments.md`. All assigned implementation rows and the exit gate are verified; work stops here.

Baseline evidence: `plans/evidence/phase2/baseline*`. The restricted test launch cannot read parent directories; the same authorized checks passed with normal filesystem access. Prepared free WSL Docker Engine and Supabase CLI 2.118.0 were verified available. Earlier phase reports are evidence to recheck, not completion assumptions.
