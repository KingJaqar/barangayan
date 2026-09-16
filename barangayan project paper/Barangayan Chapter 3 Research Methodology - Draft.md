# Chapter 3. Research Methodology and Operational Framework

## 3.1 Research Methodology and Operational Framework

### 3.1.1 Research design

This study employs technical developmental research to design, develop, test, and evaluate Barangayan, a mobile- and web-based barangay management system. It builds on the problem statement, objectives, scope, conceptual framework, and system architecture established in Chapters 1 and 2. The study focuses on producing a usable development build for Barangay Ampid I, San Mateo, Rizal, and on documenting the evidence needed to evaluate the system.

The research process combines system development and evaluation. The development component includes requirements analysis, system and database design, application development, integration, technical testing, revision, and documentation. The evaluation component collects structured feedback from intended users and records test results for the defined workflows and quality criteria.

The study follows an Input-Process-Output framework:

~~~text
Inputs
Project requirements; Chapter 1 and Chapter 2 specifications;
Barangay Ampid I context; user requirements; technology stack;
test data; evaluation criteria; and development documentation

Process
Requirements validation -> system design -> development -> integration
-> technical testing -> user evaluation -> revision -> documentation

Outputs
Barangayan development build; test records; user-evaluation results;
defect and revision records; implementation documentation; and
recommendations for controlled deployment
~~~

This study does not claim that the system is production-ready, legally compliant, or deployed for live public transactions. Such conclusions require completed technical testing, formal operational approval, and compliance with applicable privacy and provider requirements.

### 3.1.2 Study setting and target users

The study site is Barangay Ampid I, San Mateo, Rizal. The site has been approved for the study by the Barangay Captain, Hon. Elmer B. Manahan. The Philippine Statistics Authority reports that Ampid I had a population of 26,953 in the 2024 Census of Population.

The target users are:

- residents who may request barangay documents and services, submit incident reports, view emergency information, register for health-related activities, and track transactions;
- the 10 elected barangay officials who make or supervise service, emergency, and administrative decisions; and
- administrative and auxiliary support staff who process requests, manage records, update content, and support day-to-day barangay operations.

The study evaluates the system in the context of the workflows defined in Chapters 1 and 2. It does not represent all Philippine barangays or claim that results from Ampid I automatically apply to other locations.

### 3.1.3 Participants and sampling procedure

Barangay Ampid I has a population of 26,953 residents. However, this study uses a small, task-based usability evaluation rather than a population survey. The participant count is therefore not calculated using Cochran's formula, because the purpose is to identify workflow problems, usability concerns, and needed revisions in the development build, not to produce statistically generalizable estimates for the entire resident population.

The planned evaluation sample is 45 participants: 25 adult residents, all 10 elected barangay officials, and 10 available administrative or auxiliary support staff. This number is practical for a controlled development evaluation and enables each participant group to test the workflows that match its role.

The 25 resident participants will be selected through purposive sampling with the assistance of authorized barangay personnel. To be eligible, a resident must be at least 18 years old, live in Barangay Ampid I, be able to provide informed consent, and be able to complete an assigned mobile or web task after standard orientation. The selection will seek participants with varying familiarity with mobile or web applications when practicable. A resident who declines to participate or does not meet the eligibility criteria may be replaced by another eligible resident.

All 10 elected barangay officials will be included through total enumeration because the group is small and each role may use or supervise a distinct system workflow. Ten administrative or auxiliary support staff who are available during data collection will be selected purposively to represent request processing, records management, content updates, and other relevant administrative tasks. The actual number of participants in each group will be reported with the evaluation results.

The participant groups are summarized below.

| Participant group | Population or frame | Sampling method | Planned number |
|---|---:|---|---:|
| Adult residents of Barangay Ampid I | 26,953 residents | Purposive sampling of eligible adult residents | 25 |
| Elected barangay officials | 10 officials | Total enumeration | 10 |
| Administrative and auxiliary support staff | Approximately 15 to 30 or more personnel | Purposive selection of available staff | 10 |

The study does not include an external technical-expert panel. Technical quality evidence will instead be obtained through documented test procedures and records prepared by the research team.

### 3.1.4 Data-gathering methods

The study uses the following data-gathering methods:

1. **Requirements and document review.** Chapters 1 and 2, the approved proposal, the system specifications, and the implementation records will be reviewed to maintain alignment among the problem, objectives, features, and evaluation tasks.

2. **Development documentation.** Requirements matrices, interface designs, database changes, application modules, test cases, defect records, and revision records will be maintained throughout development. These records show how each major requirement is implemented and verified.

3. **Functional and technical testing.** The research team uses controlled test accounts and synthetic data to test the resident and administrative workflows. Test records include the task, expected result, observed result, environment, status, and corrective action where needed.

4. **Task-based user evaluation.** Residents, officials, and support staff complete role-appropriate tasks, such as submitting a service request, locating request status, reporting an incident, reviewing an administrative request, or updating content. The study records task completion, errors, clarifications required, and participant feedback.

5. **Structured questionnaire.** After completing the assigned tasks, participants answer a five-point questionnaire based on relevant ISO/IEC 25010:2023 product-quality characteristics. The questionnaire focuses on functional suitability, usability, reliability, performance efficiency, compatibility, and perceived security and privacy support.

6. **Open-ended feedback.** Participants may identify unclear steps, missing information, workflow barriers, and recommended improvements. These comments will be grouped into recurring issues to guide revisions.

### 3.1.5 Unit of analysis and research variables

The primary unit of analysis is a Barangayan user workflow. Each workflow is assessed as a complete sequence from a user action to the system response. The main workflows are:

- registration, sign-in, password recovery, and profile management;
- service and document request creation, payment selection, pickup or appointment information, and status tracking;
- incident reporting with category, location, and optional photograph;
- emergency announcements, hotline information, evacuation-center information, and default-map handoff;
- health or vaccination-drive browsing and registration;
- administrative configuration, request processing, incident review, content management, and dashboard review;
- privacy-related export and deletion requests; and
- barangay-scoped access control and data separation.

The independent development inputs are the approved requirements, application modules, database rules, interface designs, and configured services. The dependent measures are task completion, task errors, user ratings, technical test results, and qualitative feedback. System features will not be treated as evidence of improved public service unless supporting evaluation data are collected.

### 3.1.6 Data organization, processing, and analysis

Development records are organized through a requirements traceability matrix. Each requirement is linked to its related feature, user role, application module, database component, test case, result, defect record, and revision decision.

Quantitative questionnaire and task data are summarized using frequency, percentage, and weighted mean. The weighted mean is computed as:

~~~text
Weighted Mean = Sum of weighted responses / Total number of responses
~~~

The five-point response scale is interpreted as follows:

| Mean range | Interpretation |
|---:|---|
| 4.21-5.00 | Very high |
| 3.41-4.20 | High |
| 2.61-3.40 | Moderate |
| 1.81-2.60 | Low |
| 1.00-1.80 | Very low |

A mean score of 3.41 or higher indicates that an evaluated criterion is acceptable for the development build, provided that no critical defect remains unresolved. Task results will be classified as completed, completed with assistance, failed, or blocked. Technical test results will be classified as passed, failed, deferred, or not applicable.

Open-ended responses are grouped by recurring theme, such as navigation, clarity of instructions, data-entry difficulty, status visibility, performance, accessibility, or missing content. The research team compares the themes with the related workflow and defect records before deciding whether a revision is required.

### 3.1.7 Research ethics, privacy, and data protection

Participation is voluntary. Before task-based evaluation or questionnaire administration, participants will receive a clear explanation of the study purpose, procedures, expected duration, possible inconvenience, privacy measures, and right to withdraw without penalty. Written or recorded informed consent will be obtained before data collection.

The study uses synthetic test accounts and test records whenever possible. It will not use live payment credentials, real payment settlement, production resident records, or unnecessary sensitive data. If a workflow requires identity, household, health, location, or photograph data for demonstration, the study will use authorized sample data and will limit access to the research team and authorized barangay personnel.

Participant responses will be coded rather than reported by name. Identifying information will be stored separately from questionnaire responses. Research records will be retained only for the approved academic purpose and disposed of in accordance with institutional requirements and barangay data-protection procedures. Technical privacy features, including authentication, role-based access control, Row-Level Security, and export and deletion functions, support privacy protection but do not by themselves establish compliance with Republic Act No. 10173.

## 3.2 Project Design

### 3.2.1 Design concept and system boundary

Barangayan is a configurable, barangay-scoped system that supports resident services and barangay administrative workflows. The project consists of a resident mobile application and a web portal for administrative and resident access, both connected to a shared Supabase backend.

~~~text
Resident Mobile Application        Web Application
          \                              /
           \                            /
            Shared schemas and application services
                              |
                 Supabase authentication and sessions
                              |
       PostgreSQL, Row-Level Security, storage, realtime
                              |
                 Server-side Edge Functions
                              |
          PayMongo and QR Ph; maps; notifications; messaging
~~~

The project boundary includes application functions, database design, access control, file storage, realtime updates, and specified provider integrations. It excludes custom route-optimization development, a custom SMS infrastructure, live payment settlement, and other production services that require separate provider accounts, contracts, or operational approval.

Evacuation-center directions are provided through handoff to the resident's default mapping application. This keeps the feature practical and consistent with the project delimitations in Chapter 1. Payment functions operate within a sandbox or test boundary until PayMongo account verification, settlement procedures, and production approval are completed.

### 3.2.2 Architectural design

The system follows the three-tier architecture established in Chapter 2.

1. **Presentation tier.** The resident mobile application and web application provide registration, forms, service requests, incident reporting, maps, emergency information, dashboards, content-management pages, notifications, and status displays.

2. **Application-logic tier.** Shared schemas, validation rules, mobile hooks, web server actions, route handlers, database functions, triggers, and Edge Functions process requests, apply workflow rules, and coordinate provider boundaries.

3. **Data tier.** Supabase Auth, PostgreSQL tables, Row-Level Security policies, storage buckets, Realtime, migrations, and seed data store records and enforce role- and barangay-scoped access.

The system applies a barangay identifier to the relevant data relationships. This design permits configuration for more than one barangay while keeping each barangay's data separate through role checks and database policies.

### 3.2.3 Functional scope

The project scope consists of the following functional components:

| Component | Main function | Expected user outcome |
|---|---|---|
| Digital service and document requests | Configurable document types, requirements, fees, request forms, and status information | Residents submit and monitor requests; staff process them |
| Service tracking | Shared statuses, history, processing targets, and selected realtime updates | Residents and staff see the current request state |
| Incident reporting and mapping | Category, description, location, optional photographs, and administrative map review | Residents report community concerns; staff review and update them |
| Emergency and DRRM information | Announcements, preparedness content, contacts, evacuation centers, and QR check-in support | Residents access current emergency information |
| Digital payment | PayMongo and QR Ph sandbox payment boundary | Residents select or initiate an approved payment option |
| Administrative management and analytics | Requests, residents, incidents, content, staff, settings, and summaries | Administrators manage barangay workflows |
| Account, security, and privacy operations | Authentication, role checks, access control, export, and deletion functions | Users access only authorized data and services |
| Help and support | Frequently asked questions and barangay contact details | Residents obtain basic guidance and support information |
| Waste prioritization | Area grouping and rule-based score for waste-related reports | Staff identify areas that may need attention |
| Medical and vaccination drives | Drive configuration, registration, priority rules, and administrative monitoring | Residents register for available health activities |

The project does not describe the listed components as fully operational until the related functional, technical, and user-evaluation evidence is recorded.

### 3.2.4 User roles and responsibilities

| Role | Responsibilities in the system | Evaluation focus |
|---|---|---|
| Resident | Manage account and profile; submit requests and incidents; view status and emergency information; register for health activities; use privacy functions | Clarity, task completion, navigation, and response visibility |
| Elected barangay official | Supervise service, emergency, incident, and administrative decisions | Workflow completeness, oversight, and information usefulness |
| Administrative or auxiliary support staff | Process requests, update records, manage content, review incidents, configure services, and support residents | Efficiency, accuracy, role access, and administrative usability |
| Research team | Develop, test, document, evaluate, and revise the system | Traceability, test evidence, defect correction, and research integrity |
| External provider | Supply payment, routing, mapping, notification, or messaging services when configured | Integration response, error handling, and dependency limits |

### 3.2.5 Expected project outputs

The study is expected to produce:

- a documented Barangayan development build for the agreed project scope;
- mobile and web interfaces for resident and administrative workflows;
- barangay-scoped database records, role-based access rules, and technical privacy functions;
- technical test cases, test records, defect logs, and revision records;
- user-evaluation questionnaires, task records, and summarized results;
- project documentation for setup, configuration, testing, limitations, and controlled handoff; and
- a recommendation on whether the evaluated development build is suitable for the next controlled project stage.

## 3.3 Project Development

### 3.3.1 Development approach

The project uses a phase-based development approach. The phases follow a practical sequence: requirements guide design, design guides implementation, and test results guide revision. The approach does not claim that the team followed a specific commercial life-cycle model.

| Phase | Main activities | Output |
|---|---|---|
| Requirements analysis | Review Chapters 1 and 2, approved scope, target users, workflows, and operational limits | Requirements and scope matrix |
| System and data design | Define the three-tier architecture, user roles, database entities, access rules, and workflows | Architecture, data-flow, and access-control documents |
| Application development | Develop mobile and web interfaces, shared validation, database changes, and server-side functions | Development build and supporting modules |
| Integration | Connect interfaces to authentication, database, storage, Realtime, payment sandbox, maps, and other approved providers | Integrated development environment |
| Technical testing | Run functional, integration, access-control, error-handling, and compatibility tests | Test records and defect log |
| User evaluation | Conduct role-based tasks and administer the evaluation questionnaire | Task records and evaluation data |
| Revision and documentation | Correct approved defects, repeat affected tests, and update documentation | Revised build and final project documentation |

### 3.3.2 Requirements analysis and planning

Requirements are organized by user role, workflow, data object, access requirement, interface, and test case. The requirements matrix identifies each feature's purpose, expected result, related user group, and the evidence needed to confirm that it functions as intended.

The following project limits remain visible during planning:

- payment processing remains in sandbox or test mode until formal provider and settlement requirements are completed;
- emergency content, hotline information, and evacuation-center data must be reviewed and owned by authorized barangay personnel;
- map, notification, messaging, and routing functions depend on external services and network availability;
- location verification is a preliminary check and does not replace barangay verification of residency;
- waste-priority scores and health-drive rules support decisions but do not replace authorized barangay or health personnel decisions; and
- privacy functions require supporting notices, retention procedures, access controls, and organizational accountability.

### 3.3.3 Implementation and integration

The project uses the existing development environment:

- React Native and Expo for the resident mobile application;
- Next.js for the web application;
- TypeScript and shared schemas for consistent data validation;
- Supabase for authentication, PostgreSQL data storage, Row-Level Security, storage, Realtime, database functions, and migrations;
- Deno-based Edge Functions for sensitive server-side operations; and
- PayMongo, QR Ph, mapping, routing, notification, and messaging services within approved integration boundaries.

Implementation records will include feature specifications, interface changes, data changes, test cases, defects, revisions, dependency versions, and environment instructions. Sensitive configuration values and provider keys will not be included in the research report.

### 3.3.4 Documentation and revision control

Each change that affects a workflow, data structure, policy, provider integration, or user-facing claim must be documented. The project documentation identifies the relevant requirement, affected module, description of the change, test result, defect reference, revision decision, and responsible project record.

The documentation also distinguishes completed development work from provider-dependent functions, content requiring barangay approval, and functions outside the project scope. This distinction supports orderly revision and prevents the paper from claiming that unimplemented or unevaluated features are complete.

## 3.4 Testing and Operating Procedure

### 3.4.1 Operating procedure

Testing is performed in a controlled development environment using authorized accounts and synthetic data. Before testing, the research team prepares the required configuration, initializes the database and test records, verifies the relevant user roles, and confirms that no live payment credentials or production resident records are used.

For each task, the tester records the test identifier, user role, environment, precondition, input, expected result, observed result, status, supporting evidence, and corrective action. After a defect is corrected, the affected workflow will be retested before the defect is marked as resolved.

The resident operating procedure includes account access, profile completion, service or document request submission, status review, incident reporting, emergency-information viewing, and other approved tasks. The administrative operating procedure includes authentication, service configuration, request processing, incident review, content management, dashboard review, and role-appropriate privacy operations.

### 3.4.2 Testing levels and criteria

| Test level | Procedure | Acceptance criterion | Evidence |
|---|---|---|---|
| Unit and validation testing | Test schemas, field validation, status rules, calculations, and shared utilities | Valid data are accepted; invalid data are rejected with clear feedback | Test output and defect record |
| Database and access-control testing | Test migrations, constraints, Row-Level Security, storage access, role checks, and barangay scoping | Users cannot access or change unauthorized records | Database test record |
| Functional testing | Perform each approved resident and administrative workflow | Expected result is reached without critical error | Test checklist, screenshots, and defect record |
| Integration testing | Test interface, database, Edge Function, payment sandbox, map, and notification boundaries | Records and status changes remain consistent across connected components | Integration log |
| Payment-boundary testing | Test sandbox initiation, status checking, cancellation, refund, webhook, duplicate event, and error cases | No live-money transaction is used; invalid or duplicate events do not create incorrect payment status | Sandbox log and reconciliation record |
| Reliability and error handling | Test unavailable network, failed upload, expired session, provider error, and interrupted update conditions | The system provides a safe error state and recovery path | Error-handling record |
| Compatibility and accessibility testing | Test approved device sizes, browsers, permissions, readable labels, keyboard access where applicable, and network conditions | Core tasks remain understandable and usable in the approved test matrix | Compatibility and accessibility checklist |
| User acceptance testing | Assign role-based tasks and administer the evaluation questionnaire | Mean evaluation score is at least 3.41 and no unresolved critical defect remains | Task record, questionnaire, and summary |

### 3.4.3 Defect handling and validation of the testing strategy

The testing strategy is supported by requirements traceability. Each project objective is linked to a workflow, test case, and result. A defect is recorded when the observed result differs from the expected result or when a participant identifies a barrier to completing an approved task.

Defects are classified as critical, high, medium, or low:

| Severity | Meaning | Required action |
|---|---|---|
| Critical | Blocks a core workflow, exposes protected data, or produces an unsafe or incorrect result | Correct before evaluation or acceptance |
| High | Seriously affects a major workflow but has a temporary workaround | Correct before final recommendation |
| Medium | Affects usability, clarity, or a non-core function | Schedule correction and retest |
| Low | Minor wording, layout, or cosmetic issue | Correct when practical and record the revision |

The correction cycle is:

~~~text
Detect -> record -> classify -> assign -> correct -> retest -> close or reopen
~~~

## 3.5 Project Evaluation

### 3.5.1 Evaluation framework

The project evaluation uses task-based testing and a structured questionnaire. The questionnaire draws on selected characteristics of ISO/IEC 25010:2023, a product-quality model for software and information systems. Only characteristics relevant to Barangayan and the participant's role are included.

| Quality area | Evaluation focus |
|---|---|
| Functional suitability | Whether the system provides the required functions for the assigned task |
| Usability | Whether screens, labels, navigation, and instructions are understandable and manageable |
| Performance efficiency | Whether the system responds within an acceptable time during normal test use |
| Reliability | Whether the system remains stable and provides safe recovery from errors |
| Compatibility | Whether core functions operate on the approved devices and browsers |
| Security and privacy support | Whether role access, authentication, and privacy-related functions behave as intended during the test |

The questionnaire measures participants' assessment of their assigned workflows. Technical checks for security, performance, and compatibility will be supported by the corresponding test records rather than participant opinion alone.

### 3.5.2 Evaluation procedure

The research team will:

1. secure the barangay's coordination and participant consent;
2. prepare test accounts, synthetic records, devices, and role-specific instructions;
3. orient each participant on the purpose of the evaluation;
4. assign representative tasks based on the participant's role;
5. observe and record task completion, errors, clarifications, and system responses;
6. administer the five-point questionnaire after the tasks;
7. collect open-ended feedback;
8. summarize task and questionnaire results;
9. record identified defects and approved revisions; and
10. retest corrected workflows before making the final project recommendation.

### 3.5.3 Evaluation tasks

| Participant group | Representative tasks |
|---|---|
| Residents | Register or sign in; manage profile; submit a document or service request; view status; report an incident; view emergency information; register for an available health activity; use help or privacy functions |
| Elected barangay officials | Review administrative information; assess request, incident, emergency, and dashboard workflows relevant to oversight |
| Administrative and auxiliary support staff | Configure service information; process requests; update status; review incidents; manage content; review resident records and summary information within assigned permissions |

All tasks use authorized test accounts and synthetic records. The evaluation does not require participants to make real payments, provide medical records, submit sensitive personal documents, or create live incident reports.

### 3.5.4 Interpretation and decision rules

The development build will be considered acceptable for the next controlled project stage when:

- the relevant evaluation criteria receive a weighted mean of at least 3.41;
- core assigned tasks can be completed by the participant groups without unresolved blocking issues;
- no critical access-control, privacy, data-integrity, or workflow defect remains open;
- payment, map, and other external dependencies are correctly labeled according to their approved operating boundary; and
- the study documentation identifies any remaining limitation and required action.

Evaluation results will be interpreted only within Barangay Ampid I and the tested environment. The study will not use the results to claim broader adoption, legal compliance, shorter service time, or improved public safety without additional evidence.

## 3.6 Work Plan

### 3.6.1 Work Breakdown Structure

The work plan follows the six-month development period stated in the project proposal. The months are relative project periods; exact calendar dates are maintained in the project-control record.

| WBS | Task and output | Period |
|---|---|---|
| 1.0 | Confirm scope, Barangay Ampid I coordination, requirements, participants, and evaluation materials | Month 1 |
| 2.0 | Prepare architecture, database design, user roles, workflow specifications, and test plan | Month 1 |
| 3.0 | Develop resident mobile workflows, shared validation, and required interfaces | Months 2-3 |
| 4.0 | Develop web-based administrative workflows, content management, and dashboards | Months 2-3 |
| 5.0 | Implement database rules, access control, storage, Edge Functions, and approved integrations | Months 3-4 |
| 6.0 | Integrate mobile, web, database, payment sandbox, maps, notifications, and test data | Month 4 |
| 7.0 | Conduct functional, integration, access-control, error-handling, compatibility, and accessibility testing | Months 4-5 |
| 8.0 | Conduct resident, official, and support-staff evaluation; collect questionnaires and task records | Month 5 |
| 9.0 | Correct defects, repeat affected tests, analyze results, and update documentation | Months 5-6 |
| 10.0 | Prepare final project paper, technical documentation, controlled-handoff requirements, and commercialization assessment | Month 6 |

## 3.7 Computing Standards and Modern Tools and Techniques

The project applies the following tools, standards, and techniques throughout planning, development, testing, and evaluation.

| Tool, standard, or technique | Application to Barangayan |
|---|---|
| React Native and Expo SDK 57 | Develop the resident-facing mobile application for the approved mobile environment |
| Expo Router | Organize resident mobile routes and protected navigation |
| Next.js 16.3.0 | Develop web-based administrative and resident-access surfaces |
| TypeScript | Define shared types and reduce data-contract inconsistency |
| Zod schemas | Validate forms and shared request data |
| Supabase PostgreSQL | Store barangay-scoped records, relationships, functions, triggers, and migrations |
| Supabase Auth | Manage account authentication, sessions, and recovery flows |
| Row-Level Security and role-based access control | Restrict data access according to user role, ownership, and barangay scope |
| Supabase Storage | Store permitted incident photographs, identity documents, and content files |
| Supabase Realtime | Support selected status, announcement, health, inventory, and payment updates |
| Deno Edge Functions | Perform sensitive server-side operations for payment, privacy, and QR-related functions |
| Vitest | Test shared schemas, status logic, calculations, and utilities |
| Leaflet and OpenStreetMap | Display administrative incident and evacuation-center maps |
| Haversine and point-in-polygon methods | Support distance ordering and preliminary location checks |
| PayMongo and QR Ph | Provide the approved sandbox boundary for digital-payment workflows |
| ISO/IEC 25010:2023 | Organize software-quality evaluation criteria |

The project uses established methods and services. Its contribution is the practical integration of configurable barangay workflows within the defined project scope, not the creation of a new algorithm or payment standard.

## 3.8 Potential for Commercialization

Barangayan has potential for controlled adoption as a configurable barangay service platform. Its principal value is the integration of resident services, incident reporting, emergency information, administrative workflows, and barangay-specific configuration in one system. The platform is intended to reduce the need to develop a similar system separately for each barangay.

Commercialization depends on validated user acceptance, technical reliability, privacy governance, operational support, provider agreements, procurement requirements, accessible deployment, training, and a sustainable cost model. The current project evaluates a development build and does not claim commercial success.

### 3.8.1 Market model

The market model is organized in stages:

| Measure | Definition for this project | Current basis |
|---|---|---|
| Total Available Market | Barangays that may need digital resident-service and administrative workflows | National opportunity; no monetary forecast is stated in this study |
| Serviceable Available Market | The 15 barangays of San Mateo, Rizal, subject to readiness, procurement, connectivity, and operational fit | PSA lists 15 barangays in San Mateo as of 31 July 2025 |
| Initial Share of Market | Barangay Ampid I as the approved study site | 1 of 15 barangays in the initial municipal service area, or 6.67% by count |

The market model is a planning tool only. It does not establish purchasing intent, approved procurement, pricing, or revenue.

### 3.8.2 Measurable benefits

| Stakeholder | Expected benefit | Measure |
|---|---|---|
| Residents | Clearer request submission and status visibility | Task completion, errors, status understanding, and user rating |
| Officials | Better oversight of service requests, incidents, and emergency information | Completion of assigned review tasks and feedback |
| Support staff | More organized processing and information management | Task completion, errors, workflow time, and comments |
| Barangay | Configurable service and content management | Ability to update approved data without changing application code |
| Future adopters | Reusable barangay-scoped configuration | Configuration effort and required code changes for a new approved setup |

The study measures usability and workflow evidence. Claims about reduced queues, lower costs, improved safety, or faster service require baseline and post-implementation operational data.

### 3.8.3 Three-year product roadmap

| Period | Product position | Key work |
|---|---|---|
| Year 1 | Controlled development and evaluation build | Complete testing, correct critical issues, document configuration, and establish the pilot evidence base |
| Year 2 | Supported barangay implementation | Improve onboarding, staff training, reporting, content management, and operational support based on approved results |
| Year 3 | Carefully scaled configurable platform | Improve accessibility, localization, monitoring, provider resilience, and multi-barangay configuration only after validation |

### 3.8.4 Go-to-market strategy

The initial strategy is to work with Barangay Ampid I as the approved study site, demonstrate the agreed workflows using controlled data, document the results, and obtain the necessary operational decisions before wider deployment. Any expansion must proceed through authorized local-government channels and include documented procurement, privacy notices, staff training, support ownership, and a clear maintenance arrangement.

## 3.9 Business Model

### 3.9.1 Value-chain position

Barangayan is positioned between barangay service operations and the technical providers needed to support digital workflows:

~~~text
Residents and barangay personnel
-> service, information, and administrative requirements
-> Barangayan configuration and workflow platform
-> Supabase authentication, database, storage, and realtime services
-> payment, map, routing, notification, and messaging providers
-> documented resident transactions and administrative actions
~~~

The platform supports barangay operations; it does not replace official decision-making, payment-provider responsibilities, or legally required government procedures.

### 3.9.2 Revenue-generation model

The project does not set a price or claim existing revenue. If Barangayan proceeds beyond the academic development stage, possible funding or revenue sources may include:

- a one-time implementation and configuration fee;
- a recurring support, hosting, or platform fee;
- training and data-preparation services; and
- approved integration or customization services.

Any model must first identify the buyer, contracting entity, ownership and licensing terms, provider charges, support responsibilities, and procurement process.

### 3.9.3 Cost and expense model

| Cost area | Examples |
|---|---|
| Development | Requirements analysis, design, programming, testing, devices, and documentation |
| Infrastructure | Database, storage, realtime services, hosting, domain, backup, and monitoring |
| External providers | Payment, messaging, push notifications, map tiles, routing, geocoding, email, and SMS |
| Operations | Support, training, maintenance, updates, security reviews, incident response, and content management |
| Governance | Privacy notices, retention procedures, access reviews, policies, and staff training |

The project does not calculate a cost or price without documented provider plans, usage estimates, staffing requirements, and approved operating arrangements.

### 3.9.4 Success metrics

| Dimension | Metric |
|---|---|
| User evaluation | Weighted mean rating, task completion, errors, and feedback themes |
| Technical quality | Passed tests, open defects, regression results, and critical-defect status |
| Service workflow | Request-status visibility, administrative processing steps, and configuration success |
| Reliability | Error handling, recovery records, update behavior, and backup or recovery evidence |
| Privacy and access | Unauthorized-access test findings, access-control results, and export/deletion records |
| Sustainability | Documented cost, support effort, provider use, and approved operating arrangement |

### 3.9.5 Risks and mitigation

| Risk | Mitigation |
|---|---|
| Unauthorized data access | Apply role checks, Row-Level Security, storage policies, and access-control testing |
| Payment or settlement not configured | Retain sandbox status until provider verification and approval are complete |
| Incomplete emergency information | Assign content review and update responsibility to authorized barangay personnel |
| Provider or network interruption | Provide clear error states, recovery procedures, and alternative barangay contact information |
| Device, browser, or accessibility limitation | Test the approved compatibility and accessibility matrix before acceptance |
| Inaccurate location data | Treat location as a preliminary check and retain administrative verification |
| Unclear support ownership | Define responsible barangay and project contacts before controlled handoff |
| Unsupported commercialization claim | Require documented demand, procurement, cost, pricing, and support evidence before expansion |

### 3.9.6 Break-even and sustainability

Break-even cannot be calculated until actual fixed costs, variable costs, service price, expected number of adopters, staffing costs, and provider charges are documented. The applicable formula is:

~~~text
Break-even number of barangays =
Fixed operating costs / Contribution margin per barangay
~~~

Sustained operation requires a designated platform owner, secure configuration management, data backup and recovery, privacy procedures, content maintenance, provider monitoring, staff training, technical support, and an approved operating budget.

## References Relevant to Chapter 3

International Organization for Standardization. (2023). *ISO/IEC 25010:2023: Systems and software engineering - Systems and software Quality Requirements and Evaluation (SQuaRE) - Product quality model.* https://www.iso.org/standard/78176.html

Philippine Statistics Authority. (n.d.). *Ampid I - Barangays.* Philippine Standard Geographic Code. Retrieved September 13, 2026, from https://psa.gov.ph/classification/psgc/barangays/0405811001

*BARANGAYAN CONTEXT (Proposal Phase) draft.* Project proposal document.

*Barangayan Chapter 1 & Chapter 2.* Project background, conceptual framework, scope, and architecture document.
