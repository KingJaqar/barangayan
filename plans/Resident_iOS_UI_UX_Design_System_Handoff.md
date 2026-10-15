# Barangayan Resident iOS UI/UX Design System Handoff

**Revision:** 2.1 — October 12, 2026

**Original design baseline:** September 27, 2026 (historical inspiration/source observations only).

**Status:** Main resident iOS design-system reference, aligned with Implementation Plan Revision 1.5 and its 21 numbered execution phases. Design/implementation/device approvals remain pending; this update does not certify a production-ready application. **Amended 2026-10-14 by owner decision OD-06 (Implementation Plan §1): no signed builds for the whole plan** — every acceptance check below that needs a signed build, physical iPhone, TestFlight or App Store is Skipped (OD-06) and never counts as evidence; design acceptance uses token/component/source review and automated tests, and native interaction quality is recorded as implemented, not device-qualified.

**Scope:** Full resident Android functional conversion into an iPhone-native experience, including all appearance preferences and approved corrective equivalents. No application code or Android UI changes are authorized by this document update.

## 0. Design authority, paired-document contract and change control

This handoff is the **main design-system reference** for all resident iOS screens, routes, modals, states and native integrations. [Resident_iOS_Implementation_Plan.md](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1) controls feature parity, shared/backend contracts, authorization/data truth, approved source corrections, implementation sequence and release gates. This handoff controls the visual and interaction expression of that complete scope: semantic tokens, components, typography/preferences, layouts, navigation presentation, accessibility, motion, feedback and design acceptance.

Read both before implementation. This is not an alternate product scope, a reduced launch slice or permission to rebuild Android UI. Retain the “Calm Civic Utility” direction and the existing token system; qualify/adapt existing iOS primitives rather than adding a parallel design/component framework.

- Preserve the plan's 52 feature sections, 1,218 source bullet checkpoints (including group headings/options), 54 route/layout entries, T01–T52/F01–F12 tests and G01–G22 gates.
- The plan's Appendices A/B own the exhaustive field/option/route/modal/native inventory; this document's §11 supplies binding design families D01–D21 and §12 maps every A-section through DX01–DX52. A shorter screen table is not permission to omit anything.
- All working outcomes remain required. Native presentation can change; fields, controls, preferences, status meanings and recovery paths cannot vanish through “simplification.”
- Plan §6.8 controls defective/partial/unreachable source dispositions, including self-only medical registration and online resident-only emergency check-in. No UI may claim household booking/check-in that the server did not perform.
- If a design rule conflicts with a data/platform constraint, fail closed on the unsafe action, record affected A/D/T/G identifiers and resolve a compatible equivalent in **both** documents before acceptance. No silent fallback to the old scope, custom navigation or arbitrary tokens.
- New working-feature exclusions or product decisions require explicit user approval. A limited pilot may remain honestly gated but cannot close full conversion.
- The permanently cancelled Android usability phase stays cancelled. Phase 0–Phase 20 refer only to the resident iOS roadmap in the Implementation Plan. Resident iOS Phase 8 builds document forms/submission; it is not the cancelled Android usability Phase 8.

### Revision alignment summary

| Superseded guidance | Current binding requirement |
|---|---|
| Bounded five-destination shell and toolbar-only Settings | Six destinations: Home / Services / Maps / Health / Reports / Settings, with native More overflow qualified on device *(device qualification Skipped — OD-06; verified by route/configuration tests)*. |
| Updates as a replacement tab name | Reports retains its four resident views; “updates” is descriptive content, not a replacement destination. |
| Optional remote push | Operating server inbox/outbox and remote push are mandatory for full conversion; permission denial never blocks ordinary use. |
| System font as the only operational face | System default plus all ten persisted mobile font choices and qualified iOS equivalents; Dynamic Type and contrast remain mandatory. |
| Generic service form/fixed fee/countdown | Legacy and charter services, approved ID versions, conditional PDF/image evidence, assessment states and both processing-time models. |
| G01–G16 / separate design phase numbering | G01–G22 and the plan's Phase 0–Phase 20, with 162 execution task checkpoints and same-candidate design evidence under G22. |

This revision synchronizes written requirements; it does not claim that the existing iOS shell implements them.

## 1. Recommended direction and key decisions

### Direction: Calm Civic Utility

Barangayan should make a resident's next step clear, not resemble a general-purpose social feed. Every operational screen answers:

1. What happened?
2. What happens next?
3. What can I do now?

Use the established Barangayan green as the primary-action and selected-state color, paired with native iOS typography, controls, transitions, and accessibility behaviors. The existing serif wordmark may appear in onboarding and brand moments only; it must not carry essential operational text.

### Approved navigation contract

Declare six stable destinations in this order:

```text
Home       Services       Maps       Health       Reports       Settings
                    Native iOS tab presentation + system More overflow
```

- **Home:** attention items, quick actions, recent requests/activity and official announcements.
- **Services:** Documents / Requests / Logs, catalogue/charters, application/review, processing, assessment, payment/pickup and receipts.
- **Maps:** incident/center discovery, working search/category filters, boundary and DRRM panel; accessible list equivalence.
- **Health:** medical calendar/list/detail, self-registration and personal registration history.
- **Reports:** Announcements / My reports / Active / Resolved views, filters/read states, concerns, corroboration and withdrawal.
- **Settings:** profile/household/verification/password, appearance, notifications, privacy/export/deletion, Help/legal/About/version and logout. It is a full destination with its own stack; toolbar avatar shortcuts remain supplemental.

Do not squeeze six custom labels into a compact iPhone bar. Use the approved native More behavior, including overflow entry/back/restoration, selected destination, safe areas and direct links. Qualification against [SDK 57 Native tabs](https://docs.expo.dev/versions/v57.0.0/sdk/router/native-tabs/) in Phase 1 is a gate, not a claim that the current shell already supports the design. An unsuccessful proof requires explicit resolution, not an unapproved architecture switch.

Preserve stack/list/filter state across tabs/More. Reselect behavior must be documented and tested without discarding a dirty form or pending mutation. Toolbar links and the Home summary give quick access to overflow destinations, never substitute for their required presence.

**Badge/count contract:** Reports has three labeled internal signals: active reports, unread resolved reports and unread announcements. Its single system badge equals unread resolved plus unread announcements; active reports are separate. Keep all three visible in Reports and accessible from Home when Reports is in More. The Home bell remains **announcements-only** with its announcement unread count; add a clearly distinct inbox entry and label/count rather than silently repurposing it. Announcements, resolved-report reads and inbox reads are independent.

Incident and announcement detail use distinct typed routes. Plan Appendix B.2 owns route identity/aliases and deep-link rules; a UUID must not be guessed into a different record type.

### Product decisions

- A server acknowledgement is the sole basis for “received,” “paid,” “verified,” “approved,” “ready,” or “completed.”
- A resident can save a local draft; a draft is explicitly **not sent**.
- Fees, processing targets, pickup instructions, eligibility, and payment options are server-authored facts. Do not hard-code values from the reference screens.
- Concerns are non-emergency. A persistent emergency disclaimer directs immediate danger to verified local emergency channels.
- Refetched server records/inbox are authoritative. Reliable remote push is required for full conversion under G13; notification delivery/timing is never an emergency guarantee. APNs, sender/outbox/receipts, preference/token lifecycle and tap routing must be proven before enablement.
- G01–G22 and all applicable feature gates remain authoritative. A disabled feature may be honestly shown in a labeled pilot, but cannot count as full parity or production completion.

## 2. Assumptions, constraints, and unresolved dependencies

### Source and evidence context

- The plan records the existing iOS workspace as partial, not the target design or evidence of completed parity. Phase 0 must revalidate its code/device/deployment state; do not preserve a limited shell merely because it exists.
- `apps/resident-android-mobile` is the functional feature reference, with six custom tabs and broader workflows for services, incidents, emergency, maps, health, and settings.
- `packages/shared` supplies domain types, schemas, document/incident constraints, and resident request-status derivation.
- Supabase source includes document, payment, incident, push-token, storage, profile, household, medical, and check-in contracts. Source presence is **not** deployed-environment evidence.
- The current [Implementation Plan](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1), including its exhaustive ledgers and G01–G22, governs scope/feasibility. This revision aligns the design with its approved decisions, not the historical limited release.
- The original handoff recorded a resident-screen PDF inspection on September 27. That is historical visual inspiration, not a new inspection or authoritative fee/timeline/policy/usability evidence. The current Android/shared baseline and supplied breakdown are recorded in plan §6.1.

### Assumptions and confirmation register

| Area | Proposed behavior | Verified constraint | Confirmation required |
|---|---|---|---|
| Residents | English-first, Filipino/Tagalog-ready, mixed digital confidence, intermittent data. | Existing resident copy is English. | Localization, translation review, and content owner. |
| Device scope | iPhone portrait, iOS 16.4+, compact through Pro Max; iPad deferred. | Expo SDK 57 documents iOS 16.4+ and the iOS app sets `supportsTablet: false`. | Release device/OS support matrix. |
| Access | Preserve every approved-public Android browse outcome; personal actions require resident authentication. | Plan A03 and action-specific gates; no anonymous concern mutation is approved. | Revalidate guest visibility of catalogue/drives/maps/content; do not narrow it to News alone. |
| Verification | Show unverified, pending review, verified, or action-needed state with remediation. | Existing profile/ID/location contracts exist. | Which services require which verification evidence, reviewer, appeal, and turnaround rules. |
| Documents | Full legacy/charter forms and rules, eleven charter fields, assessment/free/waived states and two timing models. | Plan §6.2–6.3 / A09–A18 define authoritative schemas and snapshots. | Published catalogue/charter, verification, assessment/fulfillment operations and deployed evidence. |
| Concerns | Reporter sees their own records by default; public/map visibility is category/policy-dependent. | Incident schema includes location/photos and workflow states. | Moderation, anonymity, public visibility, escalation, retention, and operator contact. |
| Attachments | Show purpose-specific formats/limits before selection; preserve file rows/progress/retry/remove. | Supporting JPEG/PNG/WebP/PDF up to 5 MiB each/ten attachments; ID image-only 5 MiB; concern photos 10 MiB each/five. | Server enforcement, HEIC final-byte conversion, scan/metadata policy, protected previews and cleanup; no invented resumable/background guarantee. |
| Notifications | Required inbox/outbox/remote push, generic previews and independent content-read states; app works when permission is denied. | G13 requires delivery/receipt/token/tap evidence, not foreground realtime alone. | APNs/sender/owners, event list and approved preference policy; SMS stays visibly unavailable unless operational consent/backend is approved. |
| Connectivity | Scoped protected drafts/cache, dated offline content and authoritative write reconciliation. | Plan requires online resident-only check-in; Android's broken queue is not working parity. | Draft retention/cleanup and reconciliation support; no offline attendance success or silent write queue. |

### Non-negotiable implementation constraints

- Secure credentials use Keychain through Expo SecureStore; private state must be account-scoped and removed on local logout/account switch.
- Existing request states are `submitted`, `in_progress`, `ready_for_pickup`, `completed`, and `cancelled`, with payment derived separately. Do not invent a persisted “needs information” state without a contract addition.
- Existing concern states are `open`, `in_progress`, `resolved`, `withdrawn`, and `unresolved`.
- QR Ph remains disabled until payment settlement, idempotency/reservation, expiry, cancellation, webhook, retry, and reconciliation gates pass.
- Medical registration is signed-in, same-tenant active-drive, self-only under the approved correction; actual/null prior-dose data and authoritative applicant number. Household booking needs a separately approved contract, not a copied picker.
- Emergency check-in is online, resident-only and server-confirmed after actual-center/tenant/role gates pass. No fabricated household attendance or automatic success for a queued attempt.

## 3. Evidence-backed reference matrix

**Evidence labels:** **DG** documented guidance cited by the original handoff; **OB** historical repository/PDF observation, September 27, 2026; **PR** design recommendation. These examples are inspiration, not current product-scope authority or a new third-party audit. No third-party app was interactively tested. The current plan and this handoff's binding requirements take precedence over analogy.

| Category | Reference and source | Specific pattern | Why it works | Adaptation for Barangayan | Limitations |
|---|---|---|---|---|---|
| IA/navigation | **DG:** [Apple accessibility HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility); **DG:** [Notion mobile navigation](https://www.notion.com/en-gb/help/workspaces-on-mobile) | Persistent labeled bottom destinations. | Lowers recall burden. | Six stable destinations with native More; Settings is a destination and toolbar shortcuts are supplemental. | Notion is a workspace, not a civic workflow. |
| Home hierarchy | **OB:** supplied PDF; **DG:** [Spotify App Store listing](https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580) | Prioritized return points and concise cards. | Residents can resume without scanning a dashboard. | Attention items first, then quick actions, announcements, recent activity. | Avoid media-feed density and personalization claims. |
| Typography/layout | **DG:** [Apple HIG accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | System text styles and adaptable layouts. | Works with Dynamic Type and established iOS reading behaviors. | System default with qualified persisted mobile font choices, Dynamic Type and content-driven heights. | Existing decorative serif is unsuitable for dense/service content. |
| Color/surfaces | **OB:** current brand green `#0F6E5B`; **PR** | Restrained brand accent plus semantic colors. | Conveys continuity without making color the only meaning. | Green = primary/selected; semantic status always includes icon and label. | Profile accent choices must never affect status colors. |
| Icons/controls | **DG:** Apple HIG; **OB:** PDF icon-plus-label navigation | Familiar symbols with visible labels. | Supports low literacy, VoiceOver, and fast scanning. | SF Symbols plus text; no icon-only essential action. | Custom art is limited to brand/illustration. |
| Forms/selection | **DG:** [Expo DocumentPicker v57](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/); **PR** | Progressive disclosure and review before commitment. | Prevents incomplete/accidental submissions. | One task per screen, sheet-based pickers, review screen before send. | File limits/types require backend policy. |
| Search/filtering | **DG:** [Spotify Search](https://support.spotify.com/us/article/search/); **DG:** [Notion Search](https://www.notion.com/help/search) | Search plus scoped filters. | Helps large inventories without making default UI complex. | Services, Reports, Help, map/center discovery and defined Home sources; scoped authorized results. | No advanced syntax/global search at launch. |
| Lists/details | **DG:** [Airbnb Messages](https://www.airbnb.com/help/article/3558); **OB:** PDF status cards | Short summaries, priority grouping, detail history. | Lists remain scannable; details explain state. | One primary fact + status + time in list; timeline only in detail. | Avoid nested-card density. |
| Sheets/dialogs | **DG:** Apple-native convention; **PR** | Contextual sheets, explicit destructive alerts. | Preserves orientation and prevents accidental loss. | Sheet for filters/picker/location source; alert for withdrawal/deletion/discard. | Do not nest sheets or put long forms inside them. |
| Motion/gestures | **DG:** Apple accessibility HIG; **PR** | Native transitions and optional swipe shortcuts. | Orients without spectacle. | Native push/sheet; visible alternative to every swipe action. | No auto-advancing carousels or parallax. |
| Loading/errors | **PR** | Immediate local feedback plus persistent result. | Residents can distinguish “working,” “failed,” and “received.” | Inline recovery; skeletons; durable receipt/status history. | Toasts alone are never critical confirmation. |
| Notifications | **DG:** [Expo Notifications v57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) | Notification tap can route into an app destination. | Reduces lost context. | Versioned route + record ID; destination refetches before display. | Existing project has no verified remote sender. |
| Accessibility | **DG:** [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Larger text, non-color cues, appropriate labels. | Supports broad resident needs. | VoiceOver contract, 44 pt targets, Dynamic Type, contrast matrix. | Requires device-assisted validation. |
| Perceived performance | **DG:** [Spotify mobile updates](https://newsroom.spotify.com/2026-05-28/playlist-folders-mobile-queue-controls-updates/); **PR** | Visible background progress. | Reduces uncertainty. | Visible foreground upload progress, dated cache and explicit retry/unknown-outcome state. | Not proof that Barangayan can perform background work. |

### Patterns intentionally excluded

Avoid a six-label custom tab bar (not the required six native destinations), image-led landing pages, glass/blur-heavy controls, color-only priority, map-only concern reporting, unbounded cards, decorative display fonts in essential forms, inert search/filter controls and operational claims copied from mockups. User-selected qualified serif font preferences are not excluded by the decorative-wordmark rule. These reduce readability or rely on unverified policy/backend behavior.

## 4. Information architecture and core flows

### Route structure

```text
Home
├─ Attention / quick actions / recent requests and activity
├─ Announcements bell and latest announcements → Reports / Announcements
├─ Report a concern → Reports / New concern
└─ Emergency information → Guidelines / Hotlines / Centers / Family / QR / Alerts

Services
├─ Documents → Catalogue/charter → Form → Review → Submitted receipt
├─ Requests → Detail/history → Legacy tracking or agency SLA
├─ Assessment → Payment selection → Pickup or QR PH → Paid receipt/PDF
└─ Logs / protected drafts

Maps
├─ Incident / center layers, search, category chips and DRRM panel
└─ Accessible list → Center/incident detail and location/route controls

Health
├─ Calendar / drive list → Drive detail → Self-registration
└─ My registrations → Status/details/timeline

Reports
├─ Announcements → Dedicated announcement detail / read-unread
├─ My reports / Active / Resolved → Dedicated incident detail
├─ New concern → Form / review / authoritative result
└─ Confirmation / withdrawal / individual and bulk resolved-read controls

Settings (native destination; may appear within system More)
├─ Profile / household / birthday / avatar / ID evidence
├─ Email / location verification / password / linked providers
├─ Appearance → Theme / accent / custom colors / font choices
├─ Notifications → OS permission and persisted push preference
├─ Privacy → Download My Data PDF/JSON / Delete My Account
└─ Help / Terms / Privacy / About / actual version / logout

Global inbox
└─ Distinct toolbar/Home entry → Server inbox → Validated record destination
```

### Core journey rules

#### Authentication and recovery

1. Signed-out root enters account choice. Preserve Welcome/value-proposition/personalization/completion through an intentional first-run/Help entry; returning users must not repeat them or lose their pending action.
2. Preserve all approved public browse outcomes and action-specific sign-in prompts. Public content is not authorization to create a request, concern, registration or check-in.
3. Retain email/password and Google; add native Sign in with Apple with approved button/callback behavior. Input traits/autofill, show-hide and error recovery must remain accessible.
4. Email registration progresses through verified OTP, committed resident details and confirmed password creation. Google/Apple retain optional setup progression; required service profile gates still apply.
5. Show locality/map/profile setup, save/skip/back rules, cooldown/expiry, interrupted restart, conflict and unknown-commit states exactly as plan A04–A07 requires.
6. Recovery copy avoids unnecessary account enumeration; the flow must follow the actual authoritative contract. Retain safe identifiers but never OTP/password/token material in screenshots, logs or restored forms.
7. Restore only a validated authorized same-account destination/draft after sign-in/setup. Session expiry explains the interruption and protects recoverable input; stale async/callback data never renders for the next account.
8. Passwordless/linked/legacy accounts, private-relay email, missing repeat Apple name, cancellation/revocation and same-account sensitive confirmation receive accurate UI—not a generic password-only dead end.

#### Document request

1. Catalogue/detail preserve legacy and charter services, all eleven charter fields, purpose rules, active availability, pricing mode and server-provided processing/fulfillment metadata.
2. Detail explains requirements in plain language, followed by “Start request.”
3. Verification gate explains exactly what action is needed; do not hide a service without explanation.
4. Form pre-fills profile facts as a read-only summary with “Edit profile.”
5. Show approved ID type/version and private front/back previews separately from supporting attachments. Preserve conditional purpose explanation, business/DTI, HOA/renter/lessor, certified-copy fields and personal-appearance acknowledgment. Validate actual allowed file bytes/types and conditional rules; provide file progress/retry/remove before review.
6. Review lists exact entered data, attachments, requirements, fee/payment condition, and privacy information.
7. First submit disables duplicate activation and says “Sending request…”.
8. Only a committed or reconciled authoritative response produces a durable reference and “We received your request” receipt. Unknown outcome keeps the same owned attempt/idempotency key and explains reconciliation; no blind resubmit/new reference.
9. Payment is a separate status/action, not part of the receipt unless authoritative payment data confirms it.

#### Concern report

1. A non-emergency warning remains visible: “For immediate danger, call emergency services. This form is not monitored for emergencies.”
2. Resident selects category, title, optional description, location source, and configured attachments.
3. Location permission denial leaves typed landmark and map-pin/manual options available.
4. Review states what staff/other residents may see according to confirmed policy.
5. Submission acknowledgement is explicit; timeout/failure preserves the draft and does not claim receipt.

#### Status communication

**Document UX mapping**

| Existing/source state | Resident label | Meaning and available action |
|---|---|---|
| Local only | Draft - not sent | Resume or discard. |
| `submitted` + assessment pending | Received — awaiting fee assessment | No payable amount is available yet; explain the next staff assessment step. |
| `submitted` + confirmed positive amount/unpaid eligible payment | Received — payment needed | Request exists and payment action is eligible according to server rules. |
| `submitted` + assessed zero/free/waived | Received — no payment required | Show authoritative assessment/basis; never infer waiver from missing amount. |
| `submitted` + paid/waived payment status | Received | Request exists; staff has not necessarily started review. |
| `in_progress` | In review | Staff is processing under actual operating rules. |
| `ready_for_pickup` | Ready for pickup | Show only server-authored instructions. |
| `completed` | Completed | Fulfillment is recorded. |
| `cancelled` | Cancelled | Show reason/action if server/policy provides it. |

**State discipline:** requirements/eligibility review messages and SLA pause reasons may explain an existing status, but must not invent a persisted “Needs information” state or unsupported resubmission transition. Design a new state only after a compatible authoritative contract is approved. Payment assessment and processing-time model are separate from the request status.

**Concern UX mapping**

| Existing state | Resident label | Explanation/action |
|---|---|---|
| `open` | Submitted | “We received your concern.” Withdrawal only if server allows it. |
| `in_progress` | Being reviewed or handled | Show a public-safe staff update. |
| `resolved` | Resolved | Show resolution note/date when provided. |
| `withdrawn` | Withdrawn | Retain history and reason. |
| `unresolved` | Closed without resolution | Explain the available reason/escalation path. |

### Notification handling

- The server inbox records its read state separately from announcement reads and resolved-report reads. Retain all three source Reports counters plus independent inbox indicators.
- A push payload is a routing hint, never authority. It contains a versioned route and opaque record ID; the app validates authorization and refetches data.
- Opening an inbox entry marks it read only after the authorized destination successfully renders; explicit inbox mark-read/mark-all actions affect inbox state only. Unavailable/deleted/unauthorized destinations retain an explanatory entry and safe Home/Reports fallback; do not silently mark related announcements or resolved reports.
- Ask for push permission only after a resident has completed a relevant service/report action or intentionally enables it in Settings.
- Use generic lock-screen copy by default: “Barangayan: You have a service update.” Connect cold/warm/terminated tap handling with deduplication and refetch. Remote delivery needs the plan's durable outbox/sender/receipts; foreground realtime is only a refresh signal.
- Show persisted app preference separately from iOS permission and delivery availability. SMS is visibly unavailable unless a real approved consent/provider backend exists. No emergency/critical-alert or background-location guarantee is introduced.

## 5. Consolidated visual tokens

All values use **iOS points (pt)**. React Native logical units map to points on iOS. This is the authoritative token table for the resident iOS product.

### Semantic colors

| Token | Light | Dark | Purpose and behavior |
|---|---:|---:|---|
| `color.canvas` | `#F7F8F7` | `#101614` | App background. |
| `color.surface` | `#FFFFFF` | `#18201D` | Grouped/list/card surface. |
| `color.surfaceRaised` | `#FFFFFF` | `#202A26` | Raised sheet/confirmation surface. |
| `color.surfaceSelected` | `#E8F4EF` | `#16382F` | Selected list/filter state. |
| `color.textPrimary` | `#171D1A` | `#F3F7F4` | Main text. |
| `color.textSecondary` | `#45534E` | `#B9C7C0` | Supporting text. |
| `color.textTertiary` | `#61716B` | `#8EA19A` | Metadata and placeholder only. |
| `color.border` | `#CDD8D2` | `#3A4A43` | Divider/field border. |
| `color.primary` | `#0D6B59` | `#35C7A0` | Primary action and selected control. |
| `color.onPrimary` | `#FFFFFF` | `#06251D` | Text/icon on primary. |
| `color.success` | `#147A3E` | `#5DDB8B` | Completed/resolved semantics. |
| `color.warning` | `#8A5A00` | `#FFD37A` | Attention/action-needed semantics. |
| `color.danger` | `#B42318` | `#FF8B82` | Error/destructive action. |
| `color.info` | `#075BAA` | `#7FC4FF` | Informational state/link. |
| `color.focus` | `#0A70D1` | `#88C7FF` | Keyboard/focus affordance. |
| `color.overlay` | `rgba(23,29,26,.36)` | `rgba(0,0,0,.52)` | Modal backdrop only. |

### Approved contrast pairings

These baseline ratios were recomputed from the exact solid sRGB hex pairs for this revision and rounded to two decimals. They are design calculations, not rendered-device verification. Recheck actual states, dark surfaces, disabled controls and every custom-accent pairing under G22; these eight examples do not certify the entire interface.

| Foreground / background | Ratio | Approved use |
|---|---:|---|
| Light `textPrimary` / light `surface` | 17.11:1 | All text. |
| Light `textSecondary` / light `surface` | 8.08:1 | Supporting text. |
| Light `textTertiary` / light `surface` | 5.14:1 | Metadata at 14 pt or larger. |
| `onPrimary` / light `primary` | 6.43:1 | Buttons/selected controls. |
| `onPrimary` / dark `primary` | 7.62:1 | Buttons/selected controls. |
| White / light `danger` | 6.57:1 | Light-theme destructive button or solid error badge. |
| White / light `info` | 6.81:1 | Light-theme solid informational badge. |
| Light `success` / light `surface` | 5.41:1 | Text/icon, paired with label/check symbol. |

Never place essential text on a photo, gradient, blur, or transparent surface. Under Reduce Transparency, replace decorative translucency with `color.surfaceRaised`.

### Typography

Use the system font as the default operational face and preserve every persisted mobile font preference using plan §6.6's qualified iOS mappings/fallbacks. Semantic size/weight/line-height roles below remain the shared typography system regardless of selected family. Map styles to Dynamic Type without capping accessibility scaling. The decorative serif wordmark remains a nonessential brand asset; a qualified user-selected Georgia/Times preference is not that wordmark.

| Token | Default size / line height | Weight | Purpose and adaptive behavior |
|---|---:|---|---|
| `type.largeTitle` | 34 / 41 pt | Bold | One screen title; wraps to two lines. |
| `type.title1` | 28 / 34 pt | Bold | Major detail title. |
| `type.title2` | 22 / 28 pt | Semibold | Section title. |
| `type.headline` | 17 / 22 pt | Semibold | Row/card title. |
| `type.body` | 17 / 23 pt | Regular | Default reading/input text. |
| `type.callout` | 16 / 21 pt | Regular | Control/supporting content. |
| `type.subheadline` | 15 / 20 pt | Regular | Secondary list text. |
| `type.footnote` | 13 / 18 pt | Regular | Metadata, never lone essential instruction. |
| `type.caption` | 12 / 16 pt | Medium | Compact status badge only. |
| `type.monoReference` | 15 / 20 pt | Monospaced | Request/report reference. |

At accessibility sizes, cards reflow vertically; status metadata moves below titles; segmented controls become menu/list selection when text cannot fit; buttons may become two lines with a 52 pt minimum height.

### Appearance preference overlays

The token table defines the default semantic palette, not permission to remove resident personalization. Preserve Light/Dark/System behavior, presets, custom hue/saturation/brightness picker, preview, active checkmark, saved count, select/delete/cancel and the ten-custom-color limit. Keep all ten mobile font choices and preview/selection states. See D18 and plan A43 for every option.

Apply custom accents to action/selection tokens while computing a readable foreground and contrasting focus/selection boundary. Keep success/warning/danger/info meanings fixed and always labeled. A problematic custom color must remain editable/represented, with a qualified contrast-safe rendering; do not silently delete the preference or turn danger green. Guest choices are session-only; persisted writes show failure/rollback or unsaved state.

### Layout and shape

| Token | Value | Purpose |
|---|---:|---|
| `space.1` / `.2` / `.3` / `.4` / `.5` / `.6` / `.7` | 4 / 8 / 12 / 16 / 20 / 24 / 32 pt | Base spacing scale. |
| `layout.margin` | 20 pt compact, 24 pt regular | Screen content inset. |
| `layout.maxReadableWidth` | 680 pt | Future large-width safeguard. |
| `layout.listRowMin` | 56 pt | Standard tappable row. |
| `layout.controlMin` | 44 x 44 pt | Minimum touch target. |
| `layout.buttonMinHeight` | 50 pt | Content may make it taller. |
| `radius.sm/md/lg/xl` | 8 / 12 / 16 / 24 pt | Field, card, sheet, pill respectively. |
| `border.hairline` | 1 pt | Use semantic border color. |
| `elevation.card` | None | Surface contrast plus border, not decorative shadow. |
| `elevation.sheet` | Native | Platform-rendered sheet only. |

The background extends into safe areas. Scroll content begins after the navigation-bar safe area and finishes above the tab bar/home indicator. Bottom action bars are inset above the home indicator and never cover a required action.

### Content rules

- List titles wrap before bounded truncation, with full approved text available in accessible label/detail; essential detail titles, instructions, amounts, references and body content remain readable without truncation, including at accessibility sizes.
- Use middle truncation only for a narrow technical reference; attachment names wrap to two lines and retain extension/size.
- In compact lists, show a shortened personal name visually only when the VoiceOver label exposes the full approved name.
- Ensure light/dark imagery has a monochrome/outline fallback; never rely on a light-only logo asset against dark surfaces.
- Resident-facing copy is concrete: “Your request was received,” not “Success”; “Open your request to upload the missing document,” not “Invalid state.”

## 6. Prioritized component specifications

### Shared component contract

All actionable components provide a visible label, minimum 44 x 44 pt target, pressed feedback within 100 ms, disabled explanation where meaningful, and accessibility role/value/hint. Loading preserves location and prevents repeat actions. Errors persist beside the affected control and are announced. Critical success remains available in the receipt/status screen.

| Priority/component | Purpose, anatomy, variants and sizing | States/interaction | Accessibility, limits, and pass/fail criteria |
|---|---|---|---|
| P0 Primary, secondary, destructive button | Label; optional leading SF Symbol; optional spinner. Filled, tinted, text, destructive variants. Minimum 50 pt high; label may wrap. | Default, pressed, disabled, loading. “Submit request” becomes “Submitting request…” while retaining context. | Role `button`; hint explains outcome. Pass: two rapid activations create at most one server attempt. |
| P0 Text field | Label, input, trailing action, helper/error. Minimum 50 pt high, content-driven. | Default/focused/filled/invalid/disabled. Validate on blur and submit; show progressive format help after first error. | Native email, phone, password, address traits and autofill. Error follows field in reading order. |
| P0 Multiline input | Label, expanding text area, optional count, helper/error. Initial 120 pt height; no fixed maximum. | Focus, filled, invalid, disabled. | Existing concern description maximum is 1,000 characters. Count is announced near the limit. |
| P0 Selector | Label, chosen value, chevron. | Opens native-style sheet/list. No arbitrary default for a consequential choice. | Role `button`, exposes selected value. Use segment only for 2-3 short peers. |
| P0 Attachment control | Instructions, allowed types/limits, add action, file rows with status/retry/remove. | Selecting, locally invalid, uploading, failed, complete, removing. | Each file is separately reachable and reads name, size, status. A selected local file is never called uploaded until server confirmation. |
| P0 Status badge/row | Icon, label, optional timestamp. Compact pill in lists; full explanation in detail. | Noninteractive unless it opens detail. | Never color-only. Pass: status is understandable in monochrome screenshot/VoiceOver. |
| P0 Request/concern card | Type icon, title, reference, status, action summary. | Pressed, selected, unavailable. | Whole card is one button; no nested targets. Two-line title, metadata after title. |
| P0 List row | Leading icon/avatar, title, value/chevron, divider. Minimum 56 pt high. | Pressed, disabled, destructive. | Reads title, value, then action. |
| P0 Alert/confirmation | Title, consequence, cancel, named final action. | Modal/destructive. | Initial focus is title; final action is “Withdraw concern” or “Delete account,” never generic “OK.” |
| P0 Screen sheet | Grabber, title, optional close, content. Half/full height. | Drag-dismiss only when unsaved state is safe. | Dismiss control exists; return focus to invoking control. |
| P1 Search | Search field, clear action, results/empty state. | Focus, typing, loading, no result. Debounce remote queries 250-300 ms. | Domain-specific hint; clear is labeled. Search does not silently clear filters. |
| P1 Filter | Filter button with active count, common chips and a complete scrollable/menu option set; never remove source categories to fit a layout. | Selected/unselected/open/clear. | “Filter, 2 active” value. Reset is always available. |
| P1 Tabs/segments | Content peers within one screen. | Selected. Immediate content update. | Role `tab`, selected trait. Use menu/list at large text instead of clipping. |
| P1 Progress | Determinate bar includes bytes/percent; indeterminate uses native spinner. | Upload/retry/paused/completed. | Numeric value announced. Do not estimate time without a source. |
| P1 Skeleton | Text-line/row geometry only. | Show after 250 ms when final layout is predictable. | Hidden from accessibility. Replacement cannot create layout shift. |
| P1 Empty/error state | Clear title, human cause, recovery action, optional help. | First use, no result, offline, authorization, server failure. | Pass: every blocking state offers Retry, Back, Settings, or Help as appropriate; no raw backend errors. |
| P0 Navigation | Native titles; six destinations with system More, supplemental avatar and distinct announcements/inbox entries. | Selected, overflow, nested stack, restored state. | Report badge counts unread resolved + unread announcements; label active reports separately. More destinations remain named, reachable and linkable. |
| P2 Transient message | Noncritical, reversible acknowledgement only. | Auto-dismiss 4-6 sec; optional Undo. | Never used for submit receipt, payment, verification, or critical error. |

### Form and upload behavior

- Recoverable non-secret drafts persist after meaningful changes/background/selection only in protected storage scoped to environment, tenant, account, service/report type and schema. No plaintext fallback; keep uploaded references separate from unprotected identity copies.
- Store attachment metadata and completed upload IDs, not unprotected local ID-document copies.
- A draft resume prompt provides Resume and Discard; sign-out warns that unsent private drafts will be removed.
- Keyboard-safe screens scroll the focused field above the keyboard. Use native input types and a visible Done action for numeric keyboards.
- Do not retry ambiguous writes. Query/reconcile server state first; duplicate prevention requires idempotency/authoritative lookup support.
- Destructive actions use confirmation. Undo is offered only for a completed, reversible local operation.

## 7. Screen-by-screen specifications

| Screen | Resident goal | Entry points | Content hierarchy | Primary / secondary actions | States and recovery | Exit/back behavior |
|---|---|---|---|---|---|---|
| Welcome | Understand value without repeating setup. | Intentional introduction/first-run or Help entry; signed-out root remains account choice. | Brand, three concrete outcomes, privacy link. | Sign in; create account; browse public updates. | Cached public content is visibly dated. | Never trap resident in onboarding. |
| Account choice, sign in and recovery | Access account safely. | Signed-out root, gated action, session expiry. | Guest/email/Google/Apple choices, identifier/password or owned OTP/recovery step. | Continue; recover; browse permitted public content. | Current setup/provider/expiry/unknown-outcome errors; retain safe identifier only. | Back to account choice or authorized origin; never force Welcome. |
| Home | Resume urgent work and learn what is new. | Home tab/deep-link fallback. | Attention items; quick actions; latest announcements; recent activity. | Request document; report concern; open notification center. | Skeleton, empty, stale/offline freshness, retry. | Tab reselect scrolls to top. |
| News list | Read official announcements. | Home; Reports; notification. | Filters, official source, date, latest-first list. | Open item; clear filter. | Empty/no network/stale source. | Restores list position. |
| Announcement detail | Understand an official update. | News/notification. | Title, official source, date, content, related action. | Related service/action where applicable. | Removed/expired/unauthorized item explains unavailability. | Returns to originating list. |
| Document catalog | Find an available document. | Services; Home action. | Search, categories, service rows. | Open document. | Empty/unavailable/load error. | Services root. |
| Document detail | Decide whether/how to request. | Catalog/search/deep link. | Purpose, requirements, availability, source-provided fee/fulfillment/target. | Start request; get help. | Verification/service-availability gate with remediation. | Preserves query/filter. |
| Request form | Supply correct information/files. | Document detail/draft. | Step title, required inputs, attachment section, help. | Continue; save draft; cancel. | Inline validation; upload retry/interruption. | Confirm discard if changed. |
| Request review | Confirm what will be sent. | Request form. | Data summary, files, conditions, privacy/consent if required. | Submit; edit section. | Duplicate prevention and explicit network failure. | Back to editable form. |
| Request receipt/detail | Track the service outcome. | Success; Services; notification. | Status, reference, next action, timeline. | Pay if eligible; view pickup; get help; cancel if allowed. | Stale/missing record route to Services. | Returns to prior Services list. |
| Maps/list | Find centers or policy-approved incident information. | Maps tab; emergency links. | Search/filter, list-first accessible option, map alternate. | Open location; use current location. | Provider/location denied/stale/offline fallback. | Maps root. |
| Health drive list/detail | Find and self-register for a confirmed drive. | Health tab; announcement. | Filter/calendar/list, eligibility, capacity/availability. | Register; view registration. | Capacity/eligibility/duplicate errors; no household applicant option. | Health root or previous detail. |
| Concern form | Report a non-emergency issue. | Home; Reports; empty state. | Emergency caveat, category, details, location, attachments. | Review; save draft. | Permission denial, upload retry, retained draft. | Confirm discard. |
| Concern review/receipt/detail | Submit then understand progress. | Concern flow; Reports; notification. | Reference, status, public-safe update/timeline. | Withdraw if server permits; get help. | Missing/withdrawn/unavailable record. | Returns to My concerns. |
| Reports | Find announcements and own/active/resolved reports. | Reports tab/More; Home/validated notification. | Four views, filters, three separate counters and individual/bulk read controls. | New concern; open typed detail; read/unread; confirm/withdraw where eligible. | View-specific empty/no-results/error/offline and optimistic-read rollback. | Preserve segment/filter/list position on return. |
| Notification center | Read and act on updates. | Toolbar; push. | Unread first, time grouping, type label. | Open; mark read; mark all read. | Destination unavailable leaves explanatory row. | Dismiss/back returns origin. |
| Settings/profile | Manage identity, safety and every preference. | Settings destination/More; toolbar shortcut; gated-flow link. | Profile/household/ID/email/location/password, appearance, notifications, export/delete, Help/legal/About/version. | Edit/manage; PDF/JSON export; truthful deletion/logout. | Field-level validation, partial save/conflict, preview expiry, failed preference persistence and cleanup recovery. | Native nested back; dirty dismissal protected; tab state retained. |
| Help | Resolve a problem. | Settings/contextual help. | Search, common tasks, contact route/hours when verified. | Open article; contact support. | Cached articles and contact-unavailable state. | Restores prior query. |

### Home annotated text wireframe

```text
[Large title: Good morning, Maria]        [Announcements - 2] [Inbox - 1]

[Needs your attention]
[Barangay Clearance | Payment needed | Continue >]
[Streetlight concern | Being reviewed | View >]
[Reports summary: Active 3 | Unread resolved 1 | Unread announcements 2]

[Request a document]                   [Report a concern]

[Latest announcements]                                      [See all]
[Official update / 2 hours ago]
[Road closure on Rizal Street]
[Starts Monday, 8:00 AM. Use the marked detour...]

[Recent activity]
```

Example copy:

- “Your request was received. Reference BRG-4821. We’ll update this page when its status changes.”
- “Your request was received. It is waiting for fee assessment.”
- “Check-in has not been confirmed. Connect to the internet and retry.”
- “For immediate danger, call emergency services. Do not wait for an in-app reply.”

## 8. Motion, feedback, and performance requirements

### Motion specification

| Interaction | Purpose | Duration or specification | Interruption behavior | Reduce Motion alternative | Haptic |
|---|---|---|---|---|---|
| Button press | Confirm touch. | Native highlight/opacity; feedback within 100 ms. | Stops on release/navigation. | Same. | Selection only for consequential submit confirmation. |
| Stack push/pop | Preserve orientation. | Native iOS stack transition. | Platform back gesture wins. | Crossfade/native reduced transition. | None. |
| Bottom sheet | Show contextual choice. | Native sheet presentation. | Drag dismiss only if no unsaved work. | No exaggerated spring. | None. |
| Filter/segment | Confirm content change. | 150 ms opacity transition; no layout movement. | Latest choice wins. | Instant replacement. | Selection. |
| Upload progress | Explain transfer. | Determinate updates at most 10 visual updates/sec. | Pause/cancel/retry state persists. | Static percent/value. | None. |
| Server receipt | Confirm acknowledged write. | 200 ms check-state fade/scale; no looping animation. | Immediately tappable. | Instant state replacement. | Success. |
| Error focus | Direct recovery. | One scroll into view on submit. | Never fights manual scroll. | Same. | Error notification after submit failure only. |

### Feedback policy

- **Immediate local feedback:** press, inline validation, successful local draft save.
- **Optimistic and reversible:** read/unread state and local preference only; visibly roll back on failure.
- **Never optimistic:** service/concern submission, file-upload completion, payment, verification, approval, resolution, or check-in.
- **Skeleton:** after 250 ms for a predictable layout.
- **Indeterminate progress:** unknown-duration read/fetch.
- **Determinate progress:** file transfer only when byte progress exists.
- **Persistent completion:** committed/reconciled submission/payment/status uses a durable receipt/detail. Latest activity reflects actual records; do not fabricate a full audit stream from current status.

### Engineering targets - not measured results

| Target type | Target | Validation method |
|---|---|---|
| Design | Press acknowledgement in <=100 ms. | Physical iPhone interaction recording. |
| Engineering | Meet device refresh cadence: 60 fps on 60 Hz and 120 fps where supported; avoid sustained dropped-frame animation. | Xcode Instruments / React Native performance traces. |
| Engineering | Cached Home useful content <=2 sec p75; uncached useful skeleton <=400 ms p75. | Production telemetry on Wi-Fi and constrained cellular. |
| Engineering | Submit shows confirmed outcome <=10 sec p95 or recoverable pending/retry state. | Staging fault injection and service telemetry. |
| Engineering | No layout shift after skeleton replacement except reserved image aspect ratio. | Compact/large screenshot-video comparison. |
| Engineering | Long lists virtualize; images reserve space; route changes remain tappable. | 500-item fixture and low-memory physical-device run. |

The current repository has no measured production iOS performance or physical-device evidence. Under OD-06 the physical-iPhone and low-memory device measurements in this table are Skipped; the targets remain design requirements checked by code review and tests. These are acceptance targets, not achieved results.

## 9. Accessibility, trust, and implementation acceptance criteria

Apple guidance calls for interfaces that are intuitive, perceivable, adaptable, support larger text, avoid color-only meaning, and expose appropriate VoiceOver labels. [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) Map web accessibility intent to native behavior: semantic HTML maps to React Native accessibility role/label/state; keyboard access maps to Full Keyboard Access; DOM order maps to VoiceOver swipe order; and reduced-motion intent maps to the iOS setting.

### Pass/fail checks

- [ ] VoiceOver reads each screen in visual/logical order; decorative artwork is hidden.
- [ ] Every interactive control has a unique name, role, state, and useful hint where its consequence is not obvious.
- [ ] Focus returns predictably after dismiss, delete, or navigation back.
- [ ] The largest Accessibility Dynamic Type size has no clipped, overlapping, or unreachable essential UI.
- [ ] Every hit target is at least 44 x 44 pt, including attachment remove and close actions.
- [ ] Status is understandable in a monochrome screenshot and through VoiceOver, not color alone.
- [ ] Token-approved foreground/background pairings pass contrast; disabled controls remain legible and explained.
- [ ] Reduce Motion removes nonessential scale/slide effects; Reduce Transparency uses opaque equivalents.
- [ ] Field errors are adjacent, announced, preserve entered data, and tell resident how to recover.
- [ ] Notification previews reveal no document type, ID, address, concern content, payment amount, or health data by default.
- [ ] Sensitive attachments are behind explicit open action and never appear in unauthenticated cached UI, previews, or logs.
- [ ] A receipt/status page always distinguishes received, payment needed, in review, ready, completed, and cancelled where relevant.

### Expo SDK 57 implementation note

Read the exact [Expo SDK 57 index](https://docs.expo.dev/versions/v57.0.0/) before API/native implementation; its baseline is React Native 0.86, React 19.2.3, minimum Node 22.13.x, iOS 16.4+ and Xcode 26.4+. Plan §6.7 owns the versioned native capability matrix (tabs/More, Keychain/auth, camera/location, Files/Photos/QR/PDF, WebView and push). UI intent does not establish package compatibility or permission/signing readiness. Qualify native capabilities in rebuilt signed candidates, including [Notifications v57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/); never substitute another SDK's APIs or claim background delivery from foreground realtime.

## 10. Plan-aligned delivery and user-testing checklist

Use the implementation plan's **Phase 0, Phase 1, … Phase 20** names, dependencies, stable task identifiers and exits. Design review cannot close a phase that lacks functioning API/native/authorization/recovery integration; a mockup or temporary unavailable state is not full feature parity.

| Execution phase | Binding design contribution | Acceptance / plan dependency |
|---|---|---|
| [Phase 0 — Baseline, scope freeze and execution control](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:263) | Paired revisions, full field/state/modal annotations and DX coverage; no reduced mockup scope. Scope: D01–D21 / DX01–DX52. | T52 plus inventory completeness; baseline hashes, current-source observations and decision register. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 1 — Expo SDK 57 native foundation and six-destination navigation](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:287) | Handoff §§1/4–9; tokens and native six-destination interaction proof. Scope: D01. | T01; R01–R54 infrastructure; F01/F08/F12; signed build/configuration and native-spike records. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 2 — Typed data layer, protected persistence and lifecycle recovery](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:311) | Consistent recovery/freshness/partial-result primitives for all D-families. Scope: D01/D03/D06/D11/D12/D19/D20. | T51 and shared T50; F02–F08/F11; adapter/persistence tests and signed storage/file proofs. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 3 — Backend compatibility, authorization and domain safeguards](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:336) | Approved truthful field/status/error/retention contracts; no UI guesses or admin-only data. Scope: D03/D06/D08/D13/D14/D16/D19/D20 state contracts. | B01–B24 boundary tests; F02/F03/F09–F11; Android/web compatibility and negative post-state evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 4 — Authentication, guest access, setup, recovery and session management](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:361) | D02/D03/D17/D20, accessible native input/OTP/password/provider and interruption states. Scope: D02/D03/D17/D20. | T03–T07/T40/T42/T47; F01–F04/F07/F11/F12; G18 real-provider evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 5 — Profile, household, avatar, ID evidence and location verification](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:386) | All source selectors/options and D13/D16/D17 states, accessible sheets and explicit private previews. Scope: D13/D16/D17. | T27/T37–T39/T41; F02–F04/F06–F08/F12; G03/G04 deployed + device proof. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 6 — Appearance preferences, introduction and interaction completion](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:411) | Handoff §§5–9 and D18 are the main tokens/font/color/control contract. Scope: D01/D02/D18. | T02/T43/T50; F04/F07/F12; G22 variant evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 7 — Services catalogue, guidelines and charter detail](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:435) | D05, readable eleven-field hierarchy, proper price/target semantics and full search/option coverage. Scope: D05. | T09/T10; F01/F02/F04/F05/F12; catalogue owner/configuration evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 8 — Document forms, supporting evidence, review and authoritative submission](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:458) | D06 precise evidence/version/file states and persistent received/not-paid result. Scope: D06. | T11; F02–F07/F12; deployed submission/evidence linkage + signed file-device tests. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 9 — Request lists, detailed tracking, processing clocks, logs and request cancellation](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:483) | D07/D08 distinct request status, assessment and clocks with truthful activity/history. Scope: D07/D08. | T12/T13/T14 request tests/T18; F01–F05/F09/F12; SLA/operation chronology proof. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 10 — Fee assessment, pickup, QR PH settlement, payment cancellation and receipts](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:508) | D08 honest assessed/free/waived/pending labels, payment attempt vs service processing and durable receipt. Scope: D08. | T14–T17; F02/F03/F06/F07/F09/F12; processor receipts/webhooks/staff reconciliation + device exports. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 11 — Reports hub, announcements, read states and counters](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:533) | D15 labeled views/counts, announcement modal/detail, content reads distinct from later inbox. Scope: D15/D04/D19 count contracts. | T32/T35/T36; F01/F02/F03/F05/F07/F11/F12; exact independent counts and rollback proof. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 12 — Concern forms, photos, location, detail, corroboration and withdrawal](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:557) | D15 complete source fields/photo/modal interactions, privacy/visibility and non-emergency guidance. Scope: D15/D11 location-picker equivalent. | T32–T34; F01–F08/F12; upload/create/confirm/withdraw post-state and moderation records. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 13 — Maps discovery and emergency guidelines, hotlines and alerts](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:582) | D09/D10 full filters and accessible hub/list/freshness/permission states. Scope: D09/D10/D15. | T19 discovery/T20–T22/T28; F01/F02/F05/F07/F08/F12; content/processor approval and device map/list proof. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 14 — Evacuation centers, device location, route guidance and DRRM interactions](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:607) | D09/D11 six-action location state card, accessible center/sheet/list and no route safety guarantee. Scope: D09/D11. | T19/T23/T24; F01/F02/F05/F07/F08/F12; location/controller/provider/fallback evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 15 — QR guide, center QR exports, household QR and online emergency check-in](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:632) | D12/D13 center-vs-household payload/meaning and explicit confirmed/not-confirmed states. Scope: D12/D13. | T25–T27; F01–F03/F06–F08/F10/F12; server check-in and signed camera/capture/share/Photos proofs. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 16 — Health calendar, drive discovery, self-registration and registration history](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:656) | D14 full calendar/filter/applicant/eligibility/history controls and accurate corrective self-only copy. Scope: D14. | T29–T31; F01–F05/F07/F10/F12; role/tenant/capacity/medical result evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 17 — Server inbox, durable remote push and notification preferences](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:680) | D19 honest permission/delivery/preference/read meanings and private-preview-safe destinations. Scope: D19/D04/D15/D20. | T44 plus T36/T47/T51 integration; F01–F03/F07/F11/F12; physical-device/APNs receipt and sender monitoring evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 18 — Actionable Home, information pages, complete exports and account privacy](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:705) | D04/D20/D21 full Home/Settings hierarchy, truthful privacy/support/retention and protected-file states. Scope: D04/D20/D21. | T08/T45–T49; F01–F07/F11/F12; complete export/delete post-state and native share proofs. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 19 — Whole-app parity, accessibility, resilience and production-candidate verification](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:730) | All D/DX families with source/implementation/artifact mappings, not only happy-path screenshots. Scope: All D01–D21/DX01–DX52. | All T/F families + G17/G19/G20/G22; current-source Android comparisons, physical devices and deployed integration evidence. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |
| [Phase 20 — TestFlight, App Store preparation, rollout and final conversion sign-off](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:756) | Final G22 design approval and complete reviewer/support/disclosure/asset/accessibility evidence. Scope: All families; reviewer/onboarding/support/disclosure polish. | All G01–G22; TestFlight/store/signing/privacy/operational artifacts and final candidate audit. Follow the plan's entry dependencies, tasks and exit; no design-only completion. |

All 21 phase states and 162 plan task checkboxes start Planned/unchecked. The canonical detailed execution checklists and initialized progress ledger are in plan §4; this table is the design workstream, not a separate reduced roadmap. Each phase must implement the relevant UI/data/native/state/failure/accessibility outcome together. Final design closure spans Phases 19–20 after all feature integrations, with G17/G22 and every applicable gate.

### User-testing plan

| Assumption | Task | Participants | Evidence that changes the design |
|---|---|---|---|
| Six destinations and More are comprehensible. | Find a prior request, Reports and Settings through direct tabs/More, then return without losing filters. | 5–8 residents across age/digital confidence on compact/large iPhones. | Fewer than 80% unaided success, lost state, inaccessible overflow or confusion between service requests and reports; revise presentation without silently cutting destinations. |
| “Received” is not mistaken for approved. | Submit a request and explain what will happen next. | Residents familiar with barangay services. | Material confusion among receipt, payment, approval, and completion. |
| Attachment/location recovery works. | Report blocked drainage after denying location and photo permission. | Smaller/older iPhone and limited-data users. | Resident cannot complete using typed landmark/files. |
| Status language is trustworthy. | Compare payment needed, in review, ready for pickup, closed without resolution. | Residents and front-desk staff. | Users cannot name the needed action or staff cannot map copy to operations. |
| Large text preserves task completion. | Complete a document request at Accessibility XXL. | Dynamic Type and VoiceOver users. | Any clipped text, unreachable action, duplicate focus, or unannounced error. |
| Notification privacy/read meanings are understandable. | Review lock-screen examples, distinguish bell/inbox/report counts and open an expired update. | Residents who share devices. | Sensitive disclosure, mistaken delivery guarantee, incorrect read-state coupling or inability to recover from unavailable record. |

## 11. Binding full-parity screen and component families

The §7 table is a summary, not an exhaustive screen inventory. D01–D21 below extend the main design system to every required workflow. Apply §§5–9 tokens, component contracts, native interaction and accessibility to **all** A-checkpoints, R-routes and B.3 modals, including options not repeated here. The implementation plan remains the field/schema truth; do not replace its detailed requirements with these summaries.

| Family | Required design surface/hierarchy | Mandatory states and behavioral acceptance |
|---|---|---|
| D01 — Foundation and shared interactions | Six native destinations/More, startup splash/font/session readiness; semantic tokens, headers, fields/selectors, search/chips, lists/skeletons, result/empty/error states, sheets, keyboard/back/dirty dismissal and lifecycle. | Pending restoration/error/retry, unavailable prerequisite, true empty vs filtered empty, stale/offline, late account response and guarded modal close. All source controls remain reachable; D01 applies across every family. |
| D02 — Introduction and guest access | Welcome, value proposition, personalization/completion, account choice, browse-public entry and contextual sign-in prompts. Show an intentional introduction entry without replacing account-choice root. | Skip/back/restart/returning-user and public browse states; authentication cancellation returns to origin. Explain the specific private action rather than blocking public content. |
| D03 — Authentication and account setup | Email/password/Google/Apple choice, OTP/resend/cooldown, trusted locality/map and profile/password setup, optional provider progression, complete-profile, recovery/passwordless/linking/private-relay handling. | Mandatory vs optional steps clearly labeled; expired code/provider cancellation/revocation, missing repeat name, wrong-account proof, stale setup/conflict/unknown commit and interrupted return. Never display local completion as server readiness. |
| D04 — Home | Personalized approved greeting, profile/verification prompts, quick actions, recent requests/actual activity, latest announcements; announcement-only bell, distinct inbox entry and labeled three-count Reports summary. | Guest/signed-in, no items, stale/error, gated continuation and More links. Any search shown must have defined authorized sources and working results; no decorative input or invented notification count. |
| D05 — Catalogue and charter detail | Services Documents/Requests/Logs entry; functional catalogue search/filter, active availability and list/card hierarchy. Detail shows purpose/rules, pricing/processing metadata and all eleven charter fields as readable titled sections. | Legacy vs charter content, absent configured values, inactive/deleted record, profile/approved-ID remediation; preserve full long content without collapsing away a mandatory rule or displaying an invented fee. |
| D06 — Document application and review | Approved immutable ID type/version plus explicit private front/back previews; purpose/explanation/notes; business name/address/DTI, HOA/renter/lessor, certified-copy reference/copies and personal-appearance acknowledgment. Supporting PDF/image file rows, draft and review precede committed result. | Conditional field/attachment removal, invalid/oversize/final converted bytes, iCloud cancel/unavailable, per-file retry, pending/revoked ID, stale approval and partial upload. Unknown submission outcome preserves owned attempt, says confirmation is pending and offers reconciliation—not a fresh send. |
| D07 — Requests, activity and processing clocks | Own request filters/count/cards, detail/history/supporting evidence, latest service activity and both legacy-hours/agency-minutes tracking. Agency panel labels state, snapshotted target, agency time, resident waiting, total turnaround, wait/pause reason/history separately. | Pre-processing/running/paused/ready/released/cancelled, delayed refresh and resumed app. Display server-evaluated time/freshness; current activity is not a fabricated audit stream. Status, fee assessment and clock are separate concepts. |
| D08 — Cancellation, assessment and payments | Distinct request/payment cancellation confirmation; assessment/method/pickup/QR PH screens; pending/assessed/waived/free/paid amount/basis; QR generation/expiry/save/status/retry; committed paid receipt/reference and PDF share. | No amount payable while assessment is pending; price estimates never imply a charge. Handle already paid, expired/cancelled/unknown provider result and settlement race. Native share/Photos cancellation/error is not payment failure or success; retain authoritative receipt. |
| D09 — Maps and discovery | Incident/center layers, tenant boundary/markers, working search/category chips and DRRM draggable panel; accessible equivalent directory/list with full category set. | Selected marker/list item, unavailable WebView/processor, denied GPS and stale/offline data. Extra filter icon must work or be absent while real filters stay; accessible actions replace drag-only controls. |
| D10 — Emergency hub and information | All Guidelines/Hotlines/Centers/Family/QR/Alerts navigation and return paths; expandable guidance, validated multi-number dialer actions, period/custom name/day/year alert filters/count and announcement details. | Dated tenant fallback content, missing contact, offline cache and alert no-results/errors. Redirect obsolete hotline/guide placeholders to working sections. Emergency copy makes no guaranteed in-app monitoring or delivery claim. |
| D11 — Centers, device location and routes | Center search/nearest sorting/details/facilities/occupancy/capacity; selected center; explicit locate/retry/cancel/confirm/reject/Settings actions; origin accuracy/freshness and manual input. | Reduced/denied/Allow Once/stale/last-known fix, slow/timeout, late callback and background stop. Confirm insufficient fixes. Label unknown distances and estimated fallback distinctly; old geometry clears on origin/center changes and no route implies emergency safety. |
| D12 — Center QR, scanner and online check-in | QR guidance/permission explanation, one scanner preview, encoded center type/name/selection, center QR display/raw share/image save; authoritative resident-only center check-in result. | Malformed/foreign/inactive-center code, guest/denial/offline/duplicate/unknown commit; no checked-in success for queued data. Keep center QR separate from D13 household QR and offer manual/help alternative where supported. |
| D13 — Family and household QR | Reachable shared profile/Family household editor, name/initials/relation/role/count, add/edit/remove/detail and enlarged authenticated household QR. Preserve canonical mirror/stable ID/attendance semantics; no extra screen inferred from an unused helper. | Validation/save progress/conflict, empty/loading, destructive removal, missing/expired QR and protected cache. QR guidance does not claim this resident scanner marks all family members attended; explain the actual authorized staff/use process. |
| D14 — Medical drives and registrations | Calendar/list toggle, month/day/event dots, full drive-type/filter set, drive detail/stock/eligibility; full-screen self-registration, applicant summary/profile-edit, age/PWD/comorbidity/None/dose/consent and confirmed applicant number; personal history/status/timeline. | Full/inactive/expired drive, capacity race, duplicate, actual/null prior dose and submission failure. Remove misleading household booking from the corrected self-only flow; keep legitimate self/profile controls. No dead old modal or unsupported cancel action. |
| D15 — Reports, concerns, confirmations and reads | Four Reports views and all search/status/category/date filters; typed incident/announcement detail; concern/waste-zone/address/specific-area/location/photo/review/result; corroboration count/viewer state, withdrawal and individual/bulk read-unread actions. | Three labeled report counters, independent inbox state, snapshot-bounded bulk reads and rollback. Every source photo/description/status/content/read control is preserved; non-emergency disclaimer and approved visibility/moderation copy precede submission. |
| D16 — Profile, birthday and ID evidence | Every source demographic/contact/address/locality/employment-dependent field, avatar and household editor; birthday month/year/day/apply/cancel; all ID types, front/back pick/replace/remove/open preview and verified/pending/rejected/revoked/version state. | Read-only locality, invalid/future DOB, stale editor conflict, expired signed image and separate demographic/avatar/ID outcomes. Say partial save when demographics commit but evidence publication fails; a profile email edit is not automatically auth email change. |
| D17 — Email/location verification and password | Send/verify/resend/deadline/status, location map/GPS/manual pin/boundary/address/save, password creation/change/recovery with show-hide and provider/same-account confirmation where needed. | Old-email code invalidation, expired OTP/proof, outside/missing boundary, geocoder failure, passwordless/legacy/linking mode and unknown write result. Saved GPS is not verified residency unless server review says so. |
| D18 — Appearance preferences | Light/Dark/System handling, all presets/custom colors, hue slider and saturation/brightness square, preview/select/checkmark/count, ten-color maximum, long-press delete plus accessible equivalent, confirmation/cancel; every ten-option font chip/preview/selection. | Invalid/duplicate/eleventh color, selected-color removal, unsaved/rollback, guest/session/account/relaunch behavior. Preserve persisted font IDs and qualified iOS fallback labels; Dynamic Type, contrast-safe accents and fixed semantic statuses apply to every choice. |
| D19 — Preferences, server inbox and remote notifications | Separate persisted push opt-in, iOS permission/delivery state and inbox; generic previews, typed cold/warm tap destination and unavailable-record fallback. Distinguish Home announcements bell from inbox and content read controls. | Denied/not-determined/Settings return, opt-out/token rotation/offline logout/account switch and stale/deleted/malformed payload. Remote delivery required for completion, not guaranteed during emergency. SMS remains honestly unavailable without operational consent/backend. |
| D20 — Export, deletion, logout and sensitive cleanup | Download My Data PDF/JSON chooser/cooldown/progress/share/result; complete sectioned export only; delete warning/retention/fresh password/provider confirmation/terminal state; logout notice/route reset and protected-state cleanup. | Section failure is not complete export. Cancellation/retry/unknown deletion and Apple revocation/retained lawful record copy are accurate; ban/anonymization alone is not permanent deletion. Offline/failed cleanup cannot leak restored private data to the next account. |
| D21 — Help, policy, About, version and assets | All seven Help categories, articles/search if shown and approved support; separate Terms/Privacy rich-text accordions, About mission/vision/history/contact/developer cards, branding/license/fallback assets and actual binary version/build. | Missing/deleted/unavailable content and contact, invalid external links, long-text/accessibility and dated publisher. Extract English strings/localization labels; PHP/date-only/timezone semantics are preserved without claiming a completed Tagalog translation. |

### D05–D08 service composition and operational copy

Catalogue detail groups the eleven charter fields into clear semantic headings, retaining each configured value: office/division, classification, transaction type, who may avail, requirements, where to secure them, client steps, agency actions, fees, processing time and responsible person. Missing configuration is visibly unspecified, not guessed.

The form hierarchy is: required profile/approved evidence summary → purpose and conditional details → required supporting files/appearance acknowledgment → review → authoritative reference/status. Apply plan §6.2 limits and conditional cleanup. Explain the difference between selected local file, confirmed uploaded file, submitted request and paid receipt. Sensitive identity previews require intentional open, private expiry handling and no lock-screen/diagnostic exposure.

Request detail leads with current state, reference and eligible next action, then assessment/payment, review/history and processing. Agency time, resident waiting and total turnaround have different labels; show snapshotted target/wait reason, not a generic countdown. Pending assessment says “Awaiting fee assessment,” never “Free” or “Pay ₱0.” A QR countdown describes payment-attempt expiry only, not service processing.

### D18 font identity and accessible preference controls

| Persisted mobile ID(s) | Resident presentation / qualified iOS rendering |
|---|---|
| `system` | System Default; native system face. |
| `inter` | Inter preference preserved; explain/qualify native system fallback where Inter is not bundled. |
| `arial`, `helvetica`, `verdana` | Arial, Helvetica, Verdana labels; qualified available platform family/weight. |
| `segoe-ui`, `tahoma` | Keep selectable stored preference; explicit available system fallback, not a false downloaded-font claim. |
| `trebuchet-ms`, `georgia`, `times-new-roman` | Trebuchet MS, Georgia, Times New Roman; qualified family/weight or graceful fallback. |

These are the ten mobile choices, not all web-admin fonts. Preserve selection IDs across platforms/accounts and do not bundle unlicensed faces. Fonts change family, not semantic text-size/accessibility roles. Provide named slider/value/hex or equivalent accessible controls for colors, an accessible remove action as well as long-press, and complete scroll/list selection when font chips do not fit. A numeric/hex control is an accessibility equivalent, not permission to drop the existing hue/saturation/brightness interaction.

### Global state and modal design inventory

For each A/R entry and plan Appendix B.3 modal family, the designer/engineer records entry, primary/secondary actions, default/loading/empty/filtered-empty/error/offline/stale/unavailable/unauthorized/partial/unknown-result states where applicable, and dismissal/return/focus rules. Non-applicable states need a reason. Preserve field-level dirty state, native keyboard/input traits, safe areas and the submitted attempt across supported interruption.

Use full-screen navigation for long forms, native contextual sheets for selectors/filters and explicit destructive confirmations. Do not nest interactive sheets; dismiss/sequence them with correct focus and draft ownership. Payment, ID publication, health/check-in and deletion success are persistent authoritative outcomes, never optimistic toasts. Decorative motion must stop under Reduce Motion; iOS native dismissal must not discard an unresolved write or leave a camera/location watcher active.

### Full-parity design artifact requirements

During implementation, create a named design/evidence record per D-family with all linked A-checkpoints and routes/modal variants. Include annotated compact/large iPhone layouts, default/light/dark/custom-accent variants, all font selections, largest accessibility text, keyboard, error/recovery and guest/role boundaries. One short happy-path mockup cannot close a family.

Each artifact names the paired plan/handoff revisions, applicable semantic tokens and reused primitives, field/state contract, responsible owner, A/D/DX/R/T/F/G identifiers and evidence. Do not duplicate raw medical/identity data in mockups; use sanitized fixtures. Every A-section must pass the crosswalk below before G17/G22 sign-off.

## 12. Design-to-plan traceability and acceptance

This is a bidirectional coverage map, not a replacement for the plan. **DX01–DX52** map every source feature section to required design families. All source checkpoints within each A-section inherit that section's design contract, plus D01/common §§5–9. All 54 route/layout entries and reachable modal families in plan Appendix B require the same design-state/accessibility treatment.

The mapping establishes required design coverage only. No row is marked implemented or verified by this revision. T-family and G22 evidence must identify the exact iOS candidate; G17 checks complete parity.

| Design mapping | Plan feature requirement | Required design families | Acceptance family |
|---|---|---|---|
| DX01 | [A01 — App startup and navigation](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:993) | D01 + common D01 | Phase 1; supporting Phases 2, 4, 19–20; T01 / relevant F01–F12 / G17 / G22 |
| DX02 | [A02 — Introductory and onboarding screens](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1042) | D02 + common D01 | Phase 6; T02 / relevant F01–F12 / G17 / G22 |
| DX03 | [A03 — Account choice and guest browsing](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1069) | D02, D03 + common D01 | Phase 4; supporting Phase 1; T03 / relevant F01–F12 / G17 / G22 |
| DX04 | [A04 — Email registration](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1093) | D03 + common D01 | Phase 4; T04 / relevant F01–F12 / G17 / G22 |
| DX05 | [A05 — Login and Google authentication](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1129) | D03 + common D01 | Phase 4; T05 / relevant F01–F12 / G17 / G22 |
| DX06 | [A06 — Resident account setup](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1159) | D03 + common D01 | Phase 4; T06 / relevant F01–F12 / G17 / G22 |
| DX07 | [A07 — Password creation and recovery](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1208) | D03 + common D01 | Phase 4; T07 / relevant F01–F12 / G17 / G22 |
| DX08 | [A08 — Home dashboard](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1247) | D04 + common D01 | Phase 18; T08 / relevant F01–F12 / G17 / G22 |
| DX09 | [A09 — Services catalog](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1288) | D05 + common D01 | Phase 7; Requests/Logs integration Phase 9; T09 / relevant F01–F12 / G17 / G22 |
| DX10 | [A10 — Document requirements and guidelines](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1322) | D05 + common D01 | Phase 7; Apply/form integration Phase 8; T10 / relevant F01–F12 / G17 / G22 |
| DX11 | [A11 — Document request forms](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1360) | D06 + common D01 | Phase 8; detail/payment continuation Phases 9–10; T11 / relevant F01–F12 / G17 / G22 |
| DX12 | [A12 — Personal request list](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1418) | D07 + common D01 | Phase 9; T12 / relevant F01–F12 / G17 / G22 |
| DX13 | [A13 — Request tracking and processing time](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1455) | D07 + common D01 | Phase 9; payment continuation Phase 10; T13 / relevant F01–F12 / G17 / G22 |
| DX14 | [A14 — Request and payment cancellation](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1503) | D08 + common D01 | Phases 9–10; T14 / relevant F01–F12 / G17 / G22 |
| DX15 | [A15 — Payment selection and assessment](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1527) | D08 + common D01 | Phase 10; T15 / relevant F01–F12 / G17 / G22 |
| DX16 | [A16 — QR PH payment](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1554) | D08 + common D01 | Phase 10; T16 / relevant F01–F12 / G17 / G22 |
| DX17 | [A17 — Payment success and receipts](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1587) | D08 + common D01 | Phase 10; T17 / relevant F01–F12 / G17 / G22 |
| DX18 | [A18 — Service activity logs](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1618) | D07 + common D01 | Phase 9; T18 / relevant F01–F12 / G17 / G22 |
| DX19 | [A19 — Maps](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1640) | D09 + common D01 | Phases 13–14; T19 / relevant F01–F12 / G17 / G22 |
| DX20 | [A20 — Emergency information navigation](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1686) | D10 + common D01 | Phase 13; center/QR navigation integration Phases 14–15; T20 / relevant F01–F12 / G17 / G22 |
| DX21 | [A21 — Emergency hub and preparedness](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1710) | D10 + common D01 | Phase 13; T21 / relevant F01–F12 / G17 / G22 |
| DX22 | [A22 — Emergency hotlines](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1736) | D10 + common D01 | Phase 13; T22 / relevant F01–F12 / G17 / G22 |
| DX23 | [A23 — Evacuation-center directory](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1759) | D11 + common D01 | Phase 14; T23 / relevant F01–F12 / G17 / G22 |
| DX24 | [A24 — Device location and evacuation routing](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1809) | D11 + common D01 | Phase 14; T24 / relevant F01–F12 / G17 / G22 |
| DX25 | [A25 — Emergency QR guide and scanner](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1846) | D12 + common D01 | Phase 15; T25 / relevant F01–F12 / G17 / G22 |
| DX26 | [A26 — Showing and sharing evacuation-center QR codes](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1887) | D12 + common D01 | Phase 15; T26 / relevant F01–F12 / G17 / G22 |
| DX27 | [A27 — Family and household information](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1917) | D13 + common D01 | Phases 5 and 15; T27 / relevant F01–F12 / G17 / G22 |
| DX28 | [A28 — Emergency alerts](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:1966) | D10, D15 + common D01 | Phase 13; T28 / relevant F01–F12 / G17 / G22 |
| DX29 | [A29 — Health and medical-drive browsing](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2001) | D14 + common D01 | Phase 16; T29 / relevant F01–F12 / G17 / G22 |
| DX30 | [A30 — Medical-drive registration](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2058) | D14 + common D01 | Phase 16; T30 / relevant F01–F12 / G17 / G22 |
| DX31 | [A31 — My medical registrations](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2107) | D14 + common D01 | Phase 16; T31 / relevant F01–F12 / G17 / G22 |
| DX32 | [A32 — Reports navigation and lists](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2140) | D15 + common D01 | Phases 11–12; T32 / relevant F01–F12 / G17 / G22 |
| DX33 | [A33 — New incident report](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2183) | D15 + common D01 | Phase 12; T33 / relevant F01–F12 / G17 / G22 |
| DX34 | [A34 — Incident details and community confirmation](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2232) | D15 + common D01 | Phase 12; T34 / relevant F01–F12 / G17 / G22 |
| DX35 | [A35 — Announcements](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2276) | D15 + common D01 | Phase 11; T35 / relevant F01–F12 / G17 / G22 |
| DX36 | [A36 — Resolved-report read states and counters](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2315) | D15, D04, D19 + common D01 | Phase 11; integration Phases 17–18; T36 / relevant F01–F12 / G17 / G22 |
| DX37 | [A37 — Profile viewing and editing](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2337) | D16, D13 + common D01 | Phase 5; T37 / relevant F01–F12 / G17 / G22 |
| DX38 | [A38 — Birthday calendar](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2388) | D16 + common D01 | Phase 5; T38 / relevant F01–F12 / G17 / G22 |
| DX39 | [A39 — Profile ID verification](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2413) | D16, D06 + common D01 | Phase 5; T39 / relevant F01–F12 / G17 / G22 |
| DX40 | [A40 — Email verification in Settings](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2461) | D17, D03 + common D01 | Phase 4; T40 / relevant F01–F12 / G17 / G22 |
| DX41 | [A41 — Location verification](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2490) | D17, D11 + common D01 | Phase 5; T41 / relevant F01–F12 / G17 / G22 |
| DX42 | [A42 — Password management in Settings](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2519) | D17, D03 + common D01 | Phase 4; T42 / relevant F01–F12 / G17 / G22 |
| DX43 | [A43 — Appearance preferences](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2548) | D18 + common D01 | Phase 6; T43 / relevant F01–F12 / G17 / G22 |
| DX44 | [A44 — Notifications](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2596) | D19 + common D01 | Phase 17; T44 / relevant F01–F12 / G17 / G22 |
| DX45 | [A45 — Download My Data](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2627) | D20 + common D01 | Phase 18; T45 / relevant F01–F12 / G17 / G22 |
| DX46 | [A46 — Delete My Account](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2660) | D20, D03 + common D01 | Phase 18; T46 / relevant F01–F12 / G17 / G22 |
| DX47 | [A47 — Logout and session cleanup](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2685) | D20, D03 + common D01 | Phase 4; integration Phases 17–19; T47 / relevant F01–F12 / G17 / G22 |
| DX48 | [A48 — Help Center](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2710) | D21 + common D01 | Phase 18; T48 / relevant F01–F12 / G17 / G22 |
| DX49 | [A49 — Terms, privacy, About Us, and app information](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2743) | D21 + common D01 | Phase 18; T49 / relevant F01–F12 / G17 / G22 |
| DX50 | [A50 — Small shared interactions](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2771) | D01 + common D01 | Phases 1, 6 and 19; feature-phase controls throughout; T50 / relevant F01–F12 / G17 / G22 |
| DX51 | [A51 — Automatic and supporting functions](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2822) | D01, D03, D06, D07, D11, D12, D19, D20 + common D01 | Phase 2; feature integration Phases 4–19; T51 / relevant F01–F12 / G17 / G22 |
| DX52 | [A52 — Present in the source, but incomplete, conditional, or not connected](/C:/Users/User/barangayan/plans/Resident_iOS_Implementation_Plan.md:2862) | D01–D21 as applicable; plan §6.8 disposition + common D01 | Phase 0; corrective/partial resolutions throughout Phases 1–20; T52 / relevant F01–F12 / G17 / G22 |

### Concrete design release checks

- [ ] Every A01–A52/DX01–DX52 and required R/B.3 entry has a complete numbered-phase/task/design-state/implementation/evidence mapping; all Phase 0–Phase 20 exits are verified.
- [ ] Six destinations/native More, nested restoration, Settings access and safe typed incident/announcement links pass signed-device tests *(Skipped — OD-06; route/configuration tests replace them)*.
- [ ] All source fields/options/filter categories/photo/read/confirmation/QR/PDF actions remain available; condensed layouts do not reduce parity.
- [ ] Charter/assessment/legacy and agency clocks/paid receipt copy distinguishes server facts, estimates, drafts and unknown outcomes.
- [ ] Corrective self-only health and online resident-only check-in are accurately labeled and evidenced, with no false household result.
- [ ] Three Reports counters, announcement-only Home bell and independent server inbox reads/counts remain understandable.
- [ ] Email/Google/Apple, mandatory/optional setup, recovery/linking/revocation/sensitive confirmation and partial-save/conflict states are designed.
- [ ] All ten mobile font IDs, themes, presets and custom-color controls preserve choice with readable/accessible rendering and persistence-failure feedback.
- [ ] Maps/location/QR/permission/offline/provider-fallback states have accessible list/manual alternatives and no emergency-safety promise.
- [ ] Complete PDF/JSON export, truthful retention/deletion/logout and protected draft/cache/temp cleanup have accurate copy and recovery.
- [ ] Default/custom token colors, semantic status colors, contrast, all typography/font weights, 44 pt controls, largest Dynamic Type and compact/large layouts pass rendered/device checks.
- [ ] VoiceOver/focus, Full Keyboard Access, native keyboard/back/sheets/More, Reduce Motion/Transparency and non-color status pass every relevant journey.
- [ ] Legal/help/About/support content, actual binary version, asset licenses/fallbacks and extracted strings/date/currency formatting pass.
- [ ] Required inbox/push opt-in/denial/delivery/tap states work; SMS and OS delivery are not misrepresented.
- [ ] G17/G22 design approvals and all applicable G01–G22 use the same source/build/environment, with named owners and sanitized artifacts.
- [ ] No unavailable pilot feature or historical screenshot is treated as full-conversion evidence.

## 13. Change log and handoff completion protocol

| Revision/date | Change | Evidence / limitation |
|---|---|---|
| Original — September 27, 2026 | Calm Civic Utility, default tokens/components, accessibility/motion and historical reference observations. | Preserved as visual foundation; old limited navigation/push/single-font scope is superseded. |
| 2.0 — October 12, 2026 | Main design-system authority paired with Implementation Plan 1.4; six destinations/More, full Android parity, required push, full appearance/service/native/privacy flows, IOS phases/G01–G22, D01–D21 and DX01–DX52 mapping. | Document alignment only; source/device/backend/store/implementation gates are not certified complete. Baseline contrast examples recalculated, not rendered-device verified. |
| 2.1 — October 12, 2026 | Paired with Implementation Plan 1.5: Phase 0–Phase 20, 162 detailed execution tasks, explicit dependencies/split-workflow ownership, phase/test/gate/design mappings and embedded Planned execution ledger. | Roadmap/checklist refinement only; no code, backend, signed-build, deployment or release execution is certified complete. |
| 2.1 amendment — October 14, 2026 | Owner decision OD-06 (plan §1, decision register): no signed builds, physical-device runs, TestFlight or App Store submission in any phase. Device-only design checks are Skipped (OD-06); scope, tokens and component rules are unchanged. | Decision record only; the end state is a code-complete, non-device-verified conversion, not a store release. |

Before implementation, Phase 0 owners record current paired revisions, baseline, numbered-phase/task ownership and blockers. During execution, close subsystem tasks only with their own exit evidence and revalidate all split-family contributions in Phases 19–20. Before marking any D/DX family complete, attach approved design/implementation locators, positive and fault/accessibility results, candidate screenshots/interaction recordings, device/OS/build/environment and named review. A later scope, token, route, field/status or native behavior change must update both the authoritative document for that domain and its crosswalk/evidence impact in the other.

Unresolved policy/processor/credentials/platform facts remain explicit blockers for the applicable feature/gate. Do not solve them with invented operational copy, disabled controls labeled complete, another design system or revived Android UI work. Final design sign-off is necessary for conversion but does not replace functional/backend, TestFlight or App Store release approval.



