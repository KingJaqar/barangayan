# BARANGAYAN: A Repository-Based Static Audit and Readiness Assessment of a Configurable Barangay Service, Incident-Reporting, and Emergency-Information Platform

## Abstract

This study reports a repository-based static audit of the Barangayan development build, a configurable platform intended to support barangay service requests, incident reporting, emergency information, payments, health-drive registration, and administrative workflows. The audit asks what architecture and user-facing workflows are evidenced in the repository, which proposed capabilities are source-present or partial, what security, privacy, reproducibility, and deployment risks are identifiable, and what additional evidence is required before claims of effectiveness, legal compliance, pilot success, or production readiness can be made. The audit used qualitative artifact inspection, workflow tracing, migration and policy review, proposal-to-code reconciliation, and descriptive inventory counts from repository commit `7b4a151027408aae45e6c65bcf0493e2e43aa4df` on the `main` branch, inspected on 13 September 2026. The repository contains substantial source-level support for authentication, configurable service requests, incident reporting, mapping utilities, payment boundaries, health-drive registration, administrative workflows, privacy operations, realtime subscriptions, and barangay-scoped authorization. However, no build, migration application, runtime workflow, security test, pilot deployment, user-acceptance test, performance benchmark, or production provider verification was performed for this audit. The defensible conclusion is that Barangayan is a substantial development build with a promising configurable architecture, while its behavioral effectiveness, deployed security, legal compliance, usability, reliability, and production readiness remain unverified.

**Keywords:** barangay governance; repository audit; static audit; electronic governance; multi-tenant architecture; Supabase; Expo; Next.js; incident reporting; QR Ph; software readiness

## 1. Introduction

Barangays are the Philippines' smallest local-government units and provide frontline services such as document issuance, community communication, incident coordination, and emergency information. The attached proposal and Chapter 1-2 documents describe recurring problems associated with paper-based requests, in-person queues, informal incident reporting, and systems designed for only one locality [P1, pp. 1-5; P2, pp. 3-4]. They position Barangayan as a configurable platform intended to combine digital service requests, service tracking, incident reporting and mapping, emergency information, payments, health-drive registration, and administrative management.

The repository is not equivalent to a deployed system. It contains application source code, configuration, database migrations, tests, Edge Functions, and deployment preparation, but source presence alone does not demonstrate that a feature is reachable, correctly configured, secure under deployment conditions, usable, performant, or effective in a barangay setting. This distinction is the central methodological principle of the study.

The contribution of this paper is limited and explicit. It provides a reproducible map of the development build's source-level architecture, workflow evidence, implementation status, and unresolved readiness risks. It does not measure service-time reduction, user satisfaction, emergency outcomes, payment success, legal compliance, accessibility, or production reliability. Those claims require a separate runtime and empirical evaluation protocol.

## 2. Source Documents, Scope, and Terminology

### 2.1 Source documents

Two attached project documents were reviewed as proposal and background sources rather than as evidence that repository capabilities operate in practice:

- *Barangayan Chapter 1 & Chapter 2.pdf*, 81 pages, cited as [P2].
- *BARANGAYAN CONTEXT (Proposal Phase) draft.pdf*, 15 pages, cited as [P1].

The documents contain intended objectives, proposed modules, technical background, research framing, and claims about pilot evaluation. They are therefore compared with the repository, but their proposed or reported features are not automatically classified as verified implementation.

### 2.2 Authoritative audit scope

The audit covers the development repository at the snapshot identified in Section 5.2. The principal product surfaces are:

1. `apps/resident-android-mobile`: the Expo Router and React Native resident application;
2. `apps/admin-web`: the Next.js application containing administrative routes and a protected resident-facing browser surface;
3. `packages/shared`: shared TypeScript types, schemas, utilities, Supabase client construction, and tests;
4. `supabase`: migrations, policies, database functions, Edge Functions, local configuration, seed data, and RLS tests.

`apps/resident-web` is included only for product-boundary and duplicate-client analysis. It is not counted as a separately verified resident client because the repository does not provide one authoritative product-boundary document establishing whether it is an active alternative, a legacy surface, or a parallel product. The findings therefore refer to the Resident Mobile application and Admin Website as the principal surfaces, with the separate resident web application reported where it affects scope or system interpretation.

The audit excludes live Supabase state, private secrets, PayMongo account state, provider settlement configuration, browser or device execution, production deployment, usability studies, performance benchmarking, accessibility testing, and generated dependency internals.

### 2.3 Terminology and evidence levels

The following terms are used consistently throughout the paper:

- **Proposed:** described in [P1] or [P2], but not established in the repository audit.
- **Source-present:** relevant source, migration, route, policy, test, or configuration exists in the repository.
- **Partially evidenced:** some workflow steps are source-present, while one or more required steps are missing, deferred, placeholder-based, or unresolved.
- **Externally dependent:** operation requires a hosted provider, account, credential, webhook, settlement arrangement, or deployment setting not verified in the repository audit.
- **Runtime-verified:** supported by an executed test or documented runtime observation. No major end-to-end workflow receives this label in the present audit.
- **Production-ready:** supported by evidence covering operation, security, privacy, reliability, support, deployment, and external-service readiness. The audit does not assign this label to the development build.

The word “implemented” is avoided unless its meaning is qualified. A source-present feature is not described as fully functional unless the required workflow and runtime evidence are also available.

## 3. Research Questions and Analytical Framework

The study is governed by four research questions:

**RQ1.** What architecture, data flows, and user-facing workflows are evidenced in the Barangayan repository?

**RQ2.** Which proposed capabilities are evidenced as source-present, partially evidenced, placeholder or deferred, externally dependent, or unresolved?

**RQ3.** What security, privacy, reproducibility, testing, and deployment risks are identifiable through static inspection?

**RQ4.** What additional verification is required before claims of effectiveness, legal compliance, pilot success, or production readiness can be made?

The conceptual framework treats the repository as a chain of evidence rather than as a proxy for system performance. Proposed requirements are mapped to source artifacts, workflow completeness, tests, runtime observations, external configuration, and operational readiness. Electronic governance, configurable multi-tenancy, workflow tracking, geospatial reporting, payment integration, and public-sector privacy are used as analytical lenses for interpreting the design. They are not treated as proof that the system achieves the outcomes associated with those fields.

The study makes a distinction between two kinds of flow:

1. **System data flow:** resident or administrator input is validated, persisted, processed, synchronized, and presented by the running application.
2. **Audit evidence flow:** proposal claim is mapped to repository artifact, then classified according to the strongest evidence actually available.

This distinction prevents an Input-Process-Output diagram from being mistaken for an empirical evaluation design.

## 4. Theoretical and Conceptual Framing

### 4.1 Electronic governance and configurable public-service systems

Electronic governance provides the public-service context for digitizing document requests, records, communication, and incident reporting. [P1] and [P2] present these functions as the problem context, while related project sources describe local systems focused on particular localities or individual functions [P2, pp. 3-4, 67-68, 74-76]. The present study does not assume that digitization automatically improves service delivery. It examines whether the repository contains the architectural mechanisms required to support the proposed workflows and identifies the outcome measures needed to test whether those mechanisms produce public-service benefits.

Barangayan's intended contribution is system integration and configuration. Document types, fees, requirements, target processing times, incident categories, and selected administrative content are intended to be represented as barangay-scoped data rather than hardcoded for one locality. This is a design contribution, not evidence of transferability across barangays. Transferability requires configuration in more than one setting or a structured portability evaluation.

### 4.2 Configurable multi-tenancy and access control

The platform uses a multi-tenant concept in which multiple barangays may share an application and backend while records remain associated with a `barangay_id`. The intended control model combines authenticated sessions, role checks, server-side privileged operations, and PostgreSQL Row-Level Security (RLS). Migrations and an RLS test artifact provide source evidence of intended controls. They do not establish that the final migrated database enforces the policies correctly under all roles and storage paths.

### 4.3 Workflow tracking and realtime information

Service tracking is modeled as status transitions with status history and target processing times. Supabase Realtime is used as a publish-subscribe mechanism for selected database changes. These are established architectural patterns. The repository demonstrates related source components and tests, but the audit does not measure update latency, delivery reliability, reconnection behavior, or performance under load. “Realtime” therefore refers to the synchronization mechanism, not to a measured service-level result.

### 4.4 Location, mapping, and routing

The repository contains point-in-polygon, Haversine, and OSRM-related utilities, while the project documents describe both in-app route display and handoff to the resident's default mapping application [P1, pp. 3-4, 10; P2, pp. 10, 13-14]. These are not one coherent product requirement. The authoritative interpretation for this audit is that evacuation routing is **unresolved** until the authors document one final user flow and verify it on a device. OpenStreetMap and Leaflet-related source presence does not establish map-tile availability, usage-policy compliance, geocoding availability, location accuracy, or route reliability.

### 4.5 Privacy and public-sector data governance

The project documents connect data export and account deletion with Republic Act No. 10173, the Data Privacy Act of 2012 [P1, pp. 3-4, 12; P2, pp. 70-76]. Source-level export and deletion functions are relevant technical controls. They are not sufficient to establish legal compliance. A compliance determination would also require documented purposes, notices, lawful processing grounds, retention and disposal rules, access governance, breach procedures, data-subject procedures, and accountable organizational roles.

## 5. Methodology

### 5.1 Research design

This is a qualitative, documentary static-audit study of a software repository. It is not a survey, experiment, usability study, penetration test, performance evaluation, or legal compliance audit. No inferential statistical analysis is appropriate for the repository findings. File counts are descriptive inventory measures only; they are not quality, completeness, or coverage metrics.

### 5.2 Repository provenance and inventory

The audited repository snapshot was:

| Field | Record |
|---|---|
| Repository root | `C:\Users\User\barangayan` |
| Commit | `7b4a151027408aae45e6c65bcf0493e2e43aa4df` |
| Branch | `main` |
| Analysis date | 13 September 2026 |
| Operating environment | Windows; local working copy; secrets and hosted provider state excluded |
| Reviewer | Single reviewer; no independent adjudication performed |

The following inventory was verified by recursive file enumeration at this snapshot:

| Repository path | Inventory result | Interpretation |
|---|---:|---|
| `apps/resident-android-mobile/src/app` | 50 `.tsx` files | Mobile route and screen inventory |
| `apps/admin-web/src/app` | 106 files | Admin Website route and app inventory, including `.ts`, `.tsx`, `.css`, and `.png` files |
| `supabase/migrations` | 89 `.sql` files | Migration-history inventory |
| `packages/shared` | 12 test files | Shared schema and utility test artifacts |
| `supabase/functions` | 8 `index.ts` entry points | Edge Function entry-point inventory |

The counts describe the snapshot only. They do not measure feature quality, code coverage, reachability, migration success, or operational readiness. If the repository changes, the inventory and findings must be regenerated.

### 5.3 Evidence-collection procedure

The audit followed these steps:

1. Inspect repository structure, workspace manifests, application entry points, and package boundaries.
2. Enumerate routes, components, hooks, server actions, route handlers, shared modules, migrations, policies, Edge Functions, tests, and deployment configuration.
3. Trace representative workflows from user entry point through validation, persistence, external-service calls, and output where the source path was identifiable.
4. Search for placeholders, deferred comments, unavailable states, TODO markers, external-service assumptions, and conflicting historical configuration.
5. Review authentication configuration, RLS tests, storage policies, role checks, service-role usage, webhook verification, and export/deletion operations.
6. Compare repository evidence with [P1] and [P2], recording contradictions rather than treating proposal claims as implementation evidence.
7. Assign each capability an evidence level using the rubric in Section 2.3 and record the required verification step.

### 5.4 Unit of analysis and coding rules

The unit of analysis is a proposed capability or end-to-end workflow, not an individual file. A capability was considered source-present only when at least one relevant route, component, server function, migration, or shared module could be identified. A capability was considered partially evidenced when a required step was explicitly placeholder-based, deferred, dependent on unverified external state, or absent from the traced workflow. A capability was not considered runtime-verified unless an executed test or documented runtime observation was available in the audit record.

Each finding was recorded against the following fields:

- proposal or chapter claim;
- repository evidence location;
- workflow steps observed in source;
- missing, deferred, or external step;
- evidence level;
- principal validity or readiness risk;
- next verification action.

This protocol reduces ambiguity but does not eliminate reviewer judgment. Because only one reviewer conducted the audit, inter-rater reliability is not claimed.

### 5.5 Quality, validity, and ethics controls

The audit distinguishes artifact existence from behavioral claims, records source paths and migration or test identifiers where practical, and reports unresolved issues rather than inferring completion. A second-reviewer pass and adjudication log remain recommended for formal defense or publication.

No live resident records, private secrets, production payment credentials, or hosted provider accounts were used as audit evidence. The findings concern the repository snapshot and attached project documents. If future runtime testing uses personal, health, identity, location, or payment-related data, the research team must use synthetic or consented test data and document its data-protection procedures.

## 6. System Boundary, Architecture, and Data Flow

The authoritative audit boundary is:

```text
Resident Mobile       Admin Website       Resident Web (scope review only)
        \                  |                  /
         \                 |                 /
          Shared TypeScript schemas and utilities
                              |
                 Supabase Auth and session services
                              |
       PostgreSQL, RLS, triggers, RPCs, storage, realtime
                              |
                 Supabase Edge Functions
                              |
                 PayMongo, QR Ph, maps, and providers
```

The Resident Mobile application is an Expo Router application whose entry is declared as `expo-router/entry`. Its root layout composes authentication, profile, notification, theme, font, splash-screen, and protected-navigation behavior. The Admin Website is a Next.js App Router application with server components, client components, server actions, route handlers, browser Supabase clients, server Supabase clients, and session-refresh logic. The separate `apps/resident-web` package is a second Next.js application and is reported as a scope issue rather than as a separately verified production surface.

The data layer contains migrations, tables, triggers, RPCs, RLS policies, storage policies, seed data, and local configuration. The final live schema is distributed across migration history rather than represented by one authoritative schema snapshot. This is workable for development, but a clean migration application and final-state inspection are required for security assurance.

The root workspace manifest exposes `mobile`, `web`, and `lint` scripts. The application manifests expose package-level build, lint, typecheck, and shared-test commands, but the repository does not provide one root-level build, typecheck, test, database, Edge Function, or CI command that serves as a complete quality gate. This is a reproducibility and release-process concern, not evidence that the package-level commands fail.

## 7. Findings

### 7.1 Architecture and application boundaries

The monorepo establishes an identifiable layered architecture and shared backend boundary. The principal application entry points and package relationships are source-present. The separate `apps/resident-web` package and resident-facing routes within `apps/admin-web` create an unresolved product-boundary issue. The repository does not provide one authoritative document stating which client is active, which is alternative or legacy, and which workflows must be supported on each surface.

**Evidence level:** Source-present architecture; product boundary and runtime behavior unverified.

### 7.2 Authentication and authorization

The mobile application uses Supabase Auth methods, persisted sessions through AsyncStorage, auth-state listeners, and protected route groups. The Admin Website uses password authentication, server-side session checks, role lookup, protected administrative layouts, and a session-refresh mechanism. Administrative invitation routes use a server-only service-role client and include rollback behavior when profile persistence fails.

RLS policies and a dedicated SQL test file express tenant-isolation requirements. The test artifact asserts cases such as residents not reading another resident's service requests, residents not directly inserting payments, and administrators not operating on another barangay's records. These are useful controls and requirements, but the audit did not apply the complete migration chain or execute the tests against a live or isolated Supabase database.

**Evidence level:** Source-present security mechanisms; effective authorization and storage isolation unverified.

### 7.3 Digital service and document requests

The repository contains document-type and service-request schemas, resident request routes, identification-document upload logic, payment navigation, status actions, database functions, and administrative service pages. This supports a source-present request workflow. It does not establish that configurable catalog editing, requirements, fees, appointments, pickup scheduling, or all proposal-described document paths are complete and reachable.

The project documents describe shared appointment scheduling for document pickup and health-center appointments [P1, pp. 3-4; P2, pp. 9-11]. Migration comments and the static audit indicate that appointment and catalog-management work remains unresolved in earlier stages. The manuscript therefore treats appointment scheduling as unverified rather than complete.

**Evidence level:** Source-present request workflow; completeness and runtime operation unverified.

### 7.4 Automated service tracking and realtime updates

The shared package contains service-tracking logic and tests. Migrations contain status-related functions and triggers, while application code subscribes to selected realtime changes. This supports an intended workflow for status history, target processing times, and live synchronization.

The repository does not establish a measured service-level agreement, latency threshold, reconnection guarantee, or production load capacity. The correct claim is that realtime mechanisms are present in source, not that the system delivers updates immediately or reliably under field conditions.

**Evidence level:** Source-present tracking and realtime mechanisms; latency, reliability, and end-to-end correctness unverified.

### 7.5 Incident reporting and mapping

The mobile application contains incident-reporting screens, input validation, photo-upload logic, location fields, and database persistence. The Admin Website contains incident tables and map surfaces. Shared utilities include point-in-polygon and Haversine functions, and the web packages declare marker-clustering support.

The source supports an incident-reporting and administrative-visualization workflow. It does not prove that device location, geofencing, map tiles, geocoding, storage privacy, clustering behavior, or network interruption handling are correct. The project documents describe the location check as preliminary and subject to manual review [P1, p. 3; P2, pp. 10, 13]; the manuscript adopts that qualified interpretation.

**Evidence level:** Source-present incident workflow; geospatial, storage, and runtime behavior unverified.

### 7.6 Emergency and DRRM information

The repository contains emergency-information, evacuation-center, QR check-in, caching, map, and notification-related components. It also contains explicit placeholders for the preparedness guide, hotline directory, and QR check-in guide. The attached documents describe these features as planned or intended, but the placeholder evidence prevents classification as complete.

The offline-access claim requires testing first launch, cached launch, stale content, cache invalidation, and behavior after network loss. The routing claim also requires one final design decision: either default-map handoff or in-app OSRM route display. The proposal and Chapter 1-2 documents contain both alternatives [P1, pp. 3-4; P2, pp. 10, 13], so no single routing behavior is treated as authoritative in this audit.

**Evidence level:** Partially evidenced; content completeness, offline reliability, notifications, and routing are unverified.

### 7.7 Digital payments and QR Ph

The repository contains five payment-related Edge Functions: payment-source creation, payment-status checking, cancellation, refund, and PayMongo webhook handling. Mobile and web payment surfaces exist. The server-side placement of provider secrets and the presence of webhook-signature verification are positive source-level controls.

These artifacts establish an intended payment architecture, not live payment readiness. QR Ph participation, PayMongo account status, settlement, production credentials, webhook registration, provider limits, refund behavior, reconciliation, duplicate-event handling, and deployment-level secret configuration require external verification. The webhook-signature comparison should be reviewed for timing-safe comparison where the runtime permits it, and tests should cover malformed signatures, replay, duplicate events, and idempotent settlement.

**Evidence level:** Source-present payment architecture; sandbox, provider, webhook, settlement, and production readiness unverified.

### 7.8 Health and vaccination drives

The mobile hooks and migrations support browsing drives and registering through a database RPC. The attached proposal specifies computed priority scores, queue position, stock allocation, no-show handling, and realtime inventory [P1, p. 5; P2, pp. 11-12]. The repository audit establishes the registration path but does not establish that every proposed queue, allocation, atomic stock, and no-show behavior is complete and tested.

Because allocation of health resources can affect fairness and eligibility, the priority rules require documentation, review by the responsible health authority, and concurrency testing. A source-level score is not evidence that the policy is clinically, legally, or operationally appropriate.

**Evidence level:** Source-present registration capability; priority allocation and operational inventory behavior unverified.

### 7.9 Waste and illegal-dumping prioritization

The repository contains waste-management routes, zone operations, priority-weight constants, and a migration associated with scheduled scoring. This is evidence of a rule-based prioritization design. It is not evidence that `pg_cron` is enabled in the deployed project, that the scoring formula has been validated, or that the feature improves collection decisions.

The study should describe this capability as decision support. It should not describe it as predictive artificial intelligence or as an effectiveness result. The formula, time window, decay parameter, threshold, scheduling behavior, and official response protocol must be documented before operational claims are made.

**Evidence level:** Source-present or partially evidenced; scheduled execution and decision effectiveness unverified.

### 7.10 Administrative analytics

The project documents propose resident counts, request summaries, processing-target compliance, and incident-category summaries [P1, p. 4; P2, pp. 11-13]. The repository contains administrative pages and related data access. The audit did not verify the correctness of calculated metrics, completeness of filters, tenant scoping, or refresh behavior.

**Evidence level:** Source-present administrative surfaces; metric correctness, tenant scoping, and runtime refresh unverified.

### 7.11 Privacy operations

The repository contains data-export and account-deletion Edge Functions, mobile export formatting, rate-limiting logic, storage cleanup, anonymization-related operations, and account-banning behavior. These functions provide technical support for privacy workflows.

The paper must not state that the system “complies with” Republic Act No. 10173 solely because these functions exist. Legal compliance requires organizational policies, notices, retention schedules, lawful processing grounds, access governance, breach procedures, and accountable personnel outside the repository. Deletion completeness also requires a data inventory covering database rows, storage objects, logs, backups, provider copies, and derived records.

**Evidence level:** Source-present privacy features; deletion completeness, organizational controls, and legal compliance unverified.

### 7.12 Testing and development process

The shared package includes 12 test files covering formatting, geospatial functions, service tracking, and several schemas. An RLS isolation SQL test file is present. The root package exposes only mobile, web, and lint scripts, while package-level manifests provide build, lint, typecheck, and shared-package test commands.

No test, build, migration, or application run was performed for this audit. Consequently, the manuscript reports test artifacts rather than passing tests, coverage, integration behavior, or CI enforcement. The absence of execution is a limitation of evidence, not evidence that the tests would fail.

**Evidence level:** Test artifacts present; pass/fail, coverage, integration behavior, and CI enforcement unverified.

## 8. Reconciliation with the Proposal and Chapter 1-2 Documents

The attached PDFs contain intended requirements and, in places, language that reads as if implementation or pilot testing has already occurred. The repository audit does not accept those statements as verified results unless corresponding evidence is available in the audited snapshot or in an executed evaluation record.

| Claim in [P1] or [P2] | Repository-audit status | Corrected interpretation |
|---|---|---|
| Barangay Ampid I pilot deployment and user-acceptance testing | No deployment record, participant data, protocol, or executed results were reviewed | Proposed or claimed evaluation context; not a reported result in this audit |
| Seven core modules are fully functional and tested [P2, pp. 8-9] | Placeholder, deferred, external-dependency, and unexecuted-test evidence exists | Proposal target, not verified achievement |
| The proposal consolidates eight modules but enumerates nine, and adds a medical/vaccination module separately [P1, pp. 3-5] | Module count is internally inconsistent | Use ten capability areas in this audit and distinguish them from proposal module labels |
| Emergency guide, hotline, and QR guide are available | Explicit placeholder surfaces are present | Partially evidenced; content completion and execution required |
| Offline emergency information works | Cache-related source exists; offline behavior was not executed | Source support only; offline reliability unverified |
| In-app OSRM route display | [P1] describes in-app routing, while [P2] describes default-map handoff | Final route flow unresolved; select, document, and test one behavior |
| QR Ph payments are ready for residents | Payment functions and configuration exist; live settlement and provider state were not verified | Sandbox or externally dependent payment architecture |
| Data Privacy Act compliance | Export and deletion functions exist | Technical privacy support; legal compliance not established |
| Configurable multi-tenant reuse | Barangay-scoped schema, administrative routes, and RLS test artifacts exist | Design intent and source support; cross-barangay operation unverified |
| Algorithms are novel contributions | Haversine, point-in-polygon, OSRM, clustering, state-machine, queue, and rule-based scoring techniques are established methods | Contribution is system integration and configuration, not algorithmic novelty |
| OpenStreetMap and related tools have no cost or access constraints | Libraries are source-present, but hosted tiles, routing, geocoding, attribution, quotas, and usage policies remain relevant | Avoid blanket cost, availability, and production-service claims |

The reconciliation also corrects an important methodological issue in [P2]. The PDF describes the study as covering design, development, and pilot evaluation, while the repository-based paper has no pilot evidence. The present manuscript therefore treats pilot evaluation as a required future verification stage unless a separate pilot protocol and results are added.

## 9. Discussion

### 9.1 Defensible contribution

The strongest defensible contribution is architectural integration: Barangayan combines configurable service requests, incident reporting and mapping, emergency-information surfaces, payment boundaries, administrative workflows, health-drive registration, and privacy operations in one barangay-scoped platform. A secondary contribution is the application of configuration-based multi-tenancy to a barangay context.

The project should not claim a new algorithm. Its technical mechanisms are established methods and services applied to a local-government platform. Its potential empirical contribution, if later demonstrated through pilot data, would concern usability, process performance, reliability, or transferability across barangays. Those claims require evaluation results not present in this audit.

### 9.2 Validity and reliability of the audit

The audit has broad documentary coverage of repository artifacts and a defined coding rubric, but its conclusions remain limited by static inspection and single-reviewer judgment. It cannot rule out false positives from unreachable code, false negatives from uninspected dependency behavior, configuration-specific failures, or defects appearing only under concurrency, network interruption, device variation, or production deployment.

A stronger validation design would include a second reviewer, an adjudication log, a clean Supabase migration run, executed package tests, build and type-check results, representative end-to-end workflows, and independent developer confirmation of ambiguous source paths.

### 9.3 Security and privacy assurance

The architecture includes positive source-level controls: server-side service-role use, RLS policies, administrative role checks, ownership checks, webhook signatures, storage policies, and privacy functions. The unresolved issue is assurance. The final database policy state, storage access, CORS behavior, provider configuration, secret handling, webhook replay resistance, password and MFA settings, session expiration, and deletion completeness must be verified in a controlled environment.

The presence of an RLS test file should be described as an assurance opportunity, not as a completed assurance result. A security conclusion should state which policies were executed, against which final schema, with which roles, and with what results.

### 9.4 Practical and policy significance

The platform may reduce manual status inquiries and consolidate resident-facing services, but these are expected benefits rather than findings. The study must not claim reduced processing time, improved response, increased participation, improved emergency outcomes, or greater administrative efficiency without a pilot design that defines baseline measures, participants, instruments, comparison period, and analysis method.

The public-sector context also requires attention to accessibility, connectivity, language, disability inclusion, device availability, consent, and staff workload. A successful software workflow is not necessarily an accessible or equitable public service.

## 10. Limitations

1. The audit is based on one repository snapshot and does not establish behavior in a live environment.
2. No build, type check, test suite, migration application, browser run, emulator run, device run, or Edge Function execution was performed for this audit.
3. No pilot deployment, user-acceptance test, usability study, performance benchmark, accessibility audit, or field reliability study was available for review.
4. External services, including PayMongo, QR Ph settlement, routing, geocoding, map tiles, push notifications, email, SMS, and hosted Supabase configuration, were not verified.
5. The audit was conducted by one reviewer and did not use inter-rater reliability or independent adjudication.
6. The repository does not provide one final schema snapshot or one authoritative product-boundary document.
7. Static counts describe file inventory, not feature quality, coverage, or operational readiness.
8. Legal compliance cannot be determined from source code alone.
9. The attached proposal and Chapter 1-2 documents contain inherited claims and references that must be distinguished from audit findings.
10. The audit does not establish the quality, accuracy, or legal status of each external reference cited in the project documents beyond recording the citations for reconciliation.

## 11. Verification and Improvement Plan

### 11.1 Documentation and reproducibility

- Preserve the repository commit, branch, analysis date, operating environment, included paths, excluded paths, and inventory method in the final submission.
- Add the audit instrument and evidence log as appendices. Each finding should identify the repository path, relevant migration or test name, observed source behavior, evidence level, risk, and next verification action.
- Publish one authoritative product-boundary diagram showing Resident Mobile, Admin Website, resident web, shared package, Supabase services, provider boundaries, and webhook ingress.
- Add a root development guide covering dependency installation, environment variables, local Supabase startup, migrations, seed data, mobile launch, web launch, package tests, type checking, and deployment preparation.
- Add a root-level quality gate or document why each package-level command must be run separately. The quality gate should report build, typecheck, lint, shared tests, database tests, and Edge Function checks.

### 11.2 Code and security verification

- Apply the complete migration chain to an isolated Supabase environment and inspect the final schema, triggers, RPCs, RLS policies, storage policies, and realtime publication state.
- Execute tenant-isolation tests for residents, administrators, storage objects, announcements, requests, payments, and health-drive data.
- Resolve the historical ID-document visibility changes in migrations `0042` and `0073`, document the intended final state, and add a regression test.
- Review all Edge Function CORS headers and restrict origins where browser exposure is not required.
- Use timing-safe webhook signature comparison where supported, and test malformed signatures, replay, duplicate events, event ordering, and idempotent settlement.
- Validate service-role secret placement, missing-environment behavior, password policy, email confirmation, MFA settings, session expiration, redirect allow-lists, and deployment-specific authentication settings.
- Add a threat model identifying assets, adversaries, attack surfaces, controls, residual risks, and verification evidence.

### 11.3 Workflow and product verification

- Test registration, login, password recovery, profile verification, document upload, service-request creation, payment initiation, webhook settlement, refund, and account deletion end to end.
- Complete or explicitly label the preparedness guide, hotline directory, QR guide, activity log, and every other placeholder or deferred surface.
- Select one evacuation-routing flow and test it on representative devices with missing location permission, inaccurate GPS, no network, route failure, and stale evacuation-center data.
- Verify offline emergency content through first launch, cached launch, stale content, cache invalidation, and network restoration tests.
- Verify health-drive priority scoring, queue position, stock decrement, no-show reallocation, eligibility handling, and concurrency behavior with a responsible health-service reviewer.
- Verify waste-score scheduling and document the formula, time window, decay parameter, threshold, and official response workflow.
- Verify administrative analytics against known fixtures and test that all summaries are correctly tenant-scoped.

### 11.4 Academic evaluation

If the paper is intended to claim effectiveness rather than source readiness, add and execute a pilot protocol for Barangay Ampid I or another approved site. At minimum, define:

- participants, inclusion criteria, recruitment method, and sample size rationale;
- baseline and post-deployment service-time measures;
- usability, satisfaction, accessibility, and task-completion instruments;
- incident-response and emergency-information measures;
- privacy, consent, data minimization, and adverse-event procedures;
- missing-data handling and withdrawal procedures;
- qualitative or statistical analysis plan; and
- criteria for interpreting improvement, no change, or harm.

Until the protocol is executed, the manuscript should present pilot evaluation as proposed work rather than as a finding.

## 12. Conclusion

Barangayan is a substantial multi-application development build with a coherent Supabase-centered architecture and source-level support for configurable barangay services, resident incident reporting, administrative management, payment boundaries, health-drive registration, privacy operations, and tenant-scoped access control. The repository also contains useful test artifacts, migration history, shared validation, geospatial utilities, and deployment preparation.

The audit does not establish that the system is fully functional, secure in deployment, legally compliant, effective, usable, performant, successfully piloted, or production-ready. The most defensible contribution is the integration and configuration model, supported by a reproducible map of what is present in source and what remains unverified. Before defense or submission, the authors should preserve the provenance record, execute the highest-risk workflows, reconcile the product boundary and routing design, complete the audit evidence log, verify scholarly references, and report pilot results only if they are actually collected and analyzed.

## References

### Project and repository sources

[C1] Barangayan repository snapshot at commit `7b4a151027408aae45e6c65bcf0493e2e43aa4df`, branch `main`, inspected 13 September 2026. Root `package.json`; application package manifests; source routes, components, hooks, and libraries; shared package; Supabase configuration, migrations, functions, tests, seed data, and deployment files.

[C2] `apps/resident-android-mobile/src/app`, including the root layout, authentication routes, incident-reporting routes, service-request routes, emergency routes, settings routes, and related hooks and libraries.

[C3] `apps/admin-web/src/app`, `src/actions`, `src/app/api`, `src/lib/supabase`, `src/proxy.ts`, and administrative components.

[C4] `apps/resident-web` package, reviewed for product-boundary analysis and not treated as a separately verified resident client.

[C5] `packages/shared/src`, including schemas, Haversine and point-in-polygon utilities, OSRM helper, service-tracking logic, and the 12 shared-package test files.

[C6] `supabase/migrations`, `supabase/functions`, `supabase/tests/rls_isolation.test.sql`, `supabase/config.toml`, and `supabase/seed.sql`.

### Attached project documents

[P1] *BARANGAYAN CONTEXT (Proposal Phase) draft*. Revised topic proposal and technical background. Attached PDF, 15 pages. The document is treated as a proposal source; its intended features and pilot statements are not treated as runtime evidence.

[P2] *Barangayan: A Digital Barangay Management System Implementing DRRM, Medical Assistance, and Incident Reporting: Chapter 1 & Chapter 2*. Attached project document, 81 pages. The document is treated as proposal and background material; its statements about pilot evaluation and fully functional modules require separate supporting records.

### Related project literature and standards cited in the project documents

Bangko Sentral ng Pilipinas. (2023). *Memorandum No. M-2023-005: Adoption of the National QR Code Standard (QR Ph).* https://www.bsp.gov.ph/Regulations/Issuances/2023/M-2023-005.pdf

Barredo, A. M. D., Dimapilis, A., & Gamilla, K. (2023). *LBigayAksyon: An Android-based emergency response application with web-based emergency report generator.* Ani: Letran Calamba Research Report, 19. https://ejournals.ph/article.php?id=19650

Brillo, R. A., Montes, J. F., & Mabalot, M. A. (2023). *REPORTIT: An Android-based crime incident reporter with web mapping in Calamba.* Ani: Letran Calamba Research Report, 19. https://ejournals.ph/article.php?id=19649

Dela Peña, M. A. (2025). *E-governance in Paracale: A digital transformation for improved public service delivery and citizen engagement.* JPAIR Multidisciplinary Research Journal, 61. https://ejournals.ph/article.php?id=34489

Gasmido, W., Jr., De Guzman, J., Natividad, C. J., Sicuan, C. K. B., & Reyes, D. (2025). *Digital Barangay: Ayos Lomboy's web-based management and information system.* Psychology and Education: A Multidisciplinary Journal, 37. https://ejournals.ph/article.php?id=30193

National Privacy Commission. (2012). *Republic Act No. 10173: Data Privacy Act of 2012.* https://privacy.gov.ph/data-privacy-act/

Supabase. (n.d.). *Realtime architecture.* Supabase Documentation. https://supabase.com/docs/guides/realtime/architecture

The additional sources listed in [P1] and [P2] should be verified against the original publications before formal submission. In particular, publication metadata, URLs, access dates, author names, study designs, sample sizes, reported outcomes, and claims about generalizability should not be copied into the final paper without source-level checking.

## Appendix A. Feature Status Matrix

| Capability | Repository evidence | Evidence level | Principal unresolved issue | Required verification |
|---|---|---|---|---|
| Resident authentication | Supabase Auth calls, protected routes, persisted sessions | Source-present | Session, recovery, and deployment behavior unverified | Registration, login, recovery, session expiry, logout, device variation |
| Admin authentication | Login, role checks, protected layout, proxy/session logic | Source-present | Role bypass and production cookie behavior unverified | Role-bypass tests, cookie refresh, redirect and deployment tests |
| Configurable services | Schemas, migrations, administrative service pages, request routes | Source-present or partial | Full catalog editing, requirements, fees, pickup, and appointments unverified | End-to-end catalog, request, pickup, and appointment workflow |
| Service tracking | Shared tracking logic, status functions, realtime subscriptions | Source-present | Status transitions, SLA calculations, latency, and reconnection unverified | Database and client workflow tests plus latency and interruption tests |
| Incident reporting | Form, validation, photo upload, storage, map surfaces | Source-present | Device location, storage privacy, map rendering, and persistence unverified | Device, storage-policy, map, and end-to-end tests |
| Emergency information | Emergency routes, centers, cache, notification-related components | Partial | Preparedness, hotline, QR content, offline behavior, and delivery unverified | Placeholder completion, offline tests, notification delivery tests |
| Evacuation routing | Haversine and OSRM utilities; proposal also describes map handoff | Unresolved design | Two incompatible intended route flows | Select, document, and test one final route flow |
| Payments and QR Ph | Five payment-related Edge Functions and payment surfaces | Externally dependent | Provider, webhook, settlement, refund, reconciliation, and production state unverified | Sandbox and production-readiness tests with provider confirmation |
| Health drives | Drive browsing and registration RPC | Partial | Priority queue, inventory locking, no-show handling, and realtime updates unverified | Policy review, concurrency tests, allocation and no-show tests |
| Waste prioritization | Waste UI, weights, and scheduled-scoring migration | Source-present or partial | `pg_cron`, formula, thresholds, and operational response unverified | Execute schedule, validate formula, and document official response |
| Administrative analytics | Administrative pages and summary data access | Source-present | Metric correctness and tenant scoping unverified | Fixture-based metric validation and cross-tenant tests |
| Privacy operations | Export/deletion functions, storage cleanup, anonymization-related operations | Source-present | Completeness, retention, backups, and legal controls unverified | Data inventory, export comparison, deletion verification, policy review |
| Tenant isolation | `barangay_id` design, RLS migrations, SQL test file | Designed, unverified | Final migrated policy state and storage isolation unverified | Clean migration run and role/storage isolation tests |
| Shared tests | 12 shared-package test files | Test artifacts present | Pass/fail, coverage, and CI enforcement unverified | Run tests and report complete output and coverage |
| Mobile and web release | Expo and Next.js application configurations | Not established | Build, signing, deployment, and store/provider readiness unverified | Reproducible builds and release documentation |

## Appendix B. Minimum Reproducibility and Evaluation Record

Before submission, preserve:

1. Repository URL or archive identifier.
2. Git commit hash and branch.
3. Analysis date and operating environment.
4. File-inventory command or script and complete output.
5. Included and excluded paths.
6. Audit instrument, coding rules, and evidence log.
7. Test commands and complete outputs, including failures.
8. Supabase migration and seed procedure.
9. Environment variables used, with secrets redacted.
10. Browser, emulator, device, and provider versions used for runtime checks.
11. Threat model and security-test results.
12. Reviewer identity, independent-review status, and adjudication notes.
13. Pilot protocol, consent materials, participant description, and analysis plan if effectiveness is claimed.
14. Pilot results, missing-data handling, and adverse-event record if pilot testing is completed.
