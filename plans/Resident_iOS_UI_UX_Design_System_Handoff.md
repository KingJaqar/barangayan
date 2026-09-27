# Barangayan Resident iOS UI/UX Design System Handoff

**Date:** September 27, 2026  
**Status:** Product/design specification - implementation-ready after identified operational and backend gates are confirmed.  
**Scope:** iPhone resident services experience; no application code changed by this document.

## 1. Recommended direction and key decisions

### Direction: Calm Civic Utility

Barangayan should make a resident's next step clear, not resemble a general-purpose social feed. Every operational screen answers:

1. What happened?
2. What happens next?
3. What can I do now?

Use the established Barangayan green as the primary-action and selected-state color, paired with native iOS typography, controls, transitions, and accessibility behaviors. The existing serif wordmark may appear in onboarding and brand moments only; it must not carry essential operational text.

### Launch navigation recommendation

The existing implementation plan and partial iOS application already establish a five-tab launch shell. Preserve that bounded release architecture, but rename and organize it for resident comprehension:

```
Home       Services       Map       Health       Updates
                                           
Settings/profile: toolbar avatar on Home and Updates; direct deep links from any gated flow
```

- **Home:** attention items, quick actions, latest official announcements.
- **Services:** document catalog, document requests, payment/pickup details and service history.
- **Map:** evacuation centers and relevant incident discovery, always with an accessible list alternative.
- **Health:** medical-drive discovery and self-registration only.
- **Updates:** announcements, the resident's concerns, their concern status, and notification entry point.
- **Settings/profile:** a stack, not a sixth tab. It contains identity, verification, privacy, notifications, help, and account actions.

This keeps the approved five-tab implementation scope and avoids six cramped labels on compact iPhones. Document requests remain in Services; concern reporting remains under Updates and Home quick action. A global notification center is presented from the toolbar, not as a tab.

### Product decisions

- A server acknowledgement is the sole basis for “received,” “paid,” “verified,” “approved,” “ready,” or “completed.”
- A resident can save a local draft; a draft is explicitly **not sent**.
- Fees, processing targets, pickup instructions, eligibility, and payment options are server-authored facts. Do not hard-code values from the reference screens.
- Concerns are non-emergency. A persistent emergency disclaimer directs immediate danger to verified local emergency channels.
- In-app updates are authoritative. Push is an optional delivery channel until APNs, sender, preferences, and routing are proven.
- Existing launch gates for QR Ph, pickup, ID access, exports, deletion, medical authorization, public incidents, maps, and check-in remain authoritative; this design does not bypass them.

## 2. Assumptions, constraints, and unresolved dependencies

### Existing context inspected

- `apps/resident-ios-mobile` is an Expo SDK 57, iPhone-only application with a partial five-tab implementation, secure-storage/session work, auth, profile/settings, read-only and gated service/health/emergency paths.
- `apps/resident-android-mobile` is the functional feature reference, with six custom tabs and broader workflows for services, incidents, emergency, maps, health, and settings.
- `packages/shared` supplies domain types, schemas, document/incident constraints, and resident request-status derivation.
- Supabase source includes document, payment, incident, push-token, storage, profile, household, medical, and check-in contracts. Source presence is **not** deployed-environment evidence.
- The existing [Resident iOS Implementation Plan](Resident_iOS_Implementation_Plan.md) was read in full. Its named release gates G01-G16 and its backend safety constraints govern implementation feasibility.
- The supplied resident-screen PDF was visually inspected. It validates the existing green-led brand, familiar civic vocabulary, screen families, and status-history intention; it does not validate fixed fees, timelines, public-incident policy, or native iOS usability.

### Assumptions and confirmation register

| Area | Proposed behavior | Verified constraint | Confirmation required |
|---|---|---|---|
| Residents | English-first, Filipino/Tagalog-ready, mixed digital confidence, intermittent data. | Existing resident copy is English. | Localization, translation review, and content owner. |
| Device scope | iPhone portrait, iOS 16.4+, compact through Pro Max; iPad deferred. | Expo SDK 57 documents iOS 16.4+ and the iOS app sets `supportsTablet: false`. | Release device/OS support matrix. |
| Access | Guest can browse only approved public information; all personal actions require authentication. | Existing guest route pattern exists. | Whether anonymous concern reporting is allowed. |
| Verification | Show unverified, pending review, verified, or action-needed state with remediation. | Existing profile/ID/location contracts exist. | Which services require which verification evidence, reviewer, appeal, and turnaround rules. |
| Documents | Server returns requirements, fee, availability, fulfillment method, and target where applicable. | `document_types` contains requirements, fee, active flag, and target hours. | Actual catalog, payment/waiver rules, pickup rules, published estimates. |
| Concerns | Reporter sees their own records by default; public/map visibility is category/policy-dependent. | Incident schema includes location/photos and workflow states. | Moderation, anonymity, public visibility, escalation, retention, and operator contact. |
| Attachments | Limits/configuration shown before selection; uploads are resumable/retryable where server support exists. | Concern schema permits up to five photo URLs; existing source has size constraints. | Allowed formats, byte limits, malware checks, metadata stripping, retention. |
| Notifications | Notification center works without push; push uses generic previews by default. | Token registration exists; no confirmed server sender or inbox record. | Sender/APNs, event list, urgency policy, quiet hours, preference storage, inbox API. |
| Connectivity | Cached public/read data shows freshness; writes require acknowledgement. | Reliable offline check-in is explicitly deferred. | Draft/queue retention, idempotency, support recovery process. |

### Non-negotiable implementation constraints

- Secure credentials use Keychain through Expo SecureStore; private state must be account-scoped and removed on local logout/account switch.
- Existing request states are `submitted`, `in_progress`, `ready_for_pickup`, `completed`, and `cancelled`, with payment derived separately. Do not invent a persisted “needs information” state without a contract addition.
- Existing concern states are `open`, `in_progress`, `resolved`, `withdrawn`, and `unresolved`.
- QR Ph remains disabled until payment settlement, idempotency/reservation, expiry, cancellation, webhook, retry, and reconciliation gates pass.
- Medical registration remains signed-in-resident-only until a household-applicant contract is approved and tenant/role authorization is repaired.
- Emergency check-in remains online, resident-only, and server-confirmed until tenant/center and household semantics gates pass.

## 3. Evidence-backed reference matrix

**Evidence labels:** **DG** documented guidance; **OB** repository/PDF observation, September 27, 2026; **PR** proposed recommendation. No third-party app was interactively tested.

| Category | Reference and source | Specific pattern | Why it works | Adaptation for Barangayan | Limitations |
|---|---|---|---|---|---|
| IA/navigation | **DG:** [Apple accessibility HIG](https://developer.apple.com/design/human-interface-guidelines/accessibility); **DG:** [Notion mobile navigation](https://www.notion.com/en-gb/help/workspaces-on-mobile) | Persistent labeled bottom destinations. | Lowers recall burden. | Five stable resident destinations; profile/settings in toolbar stack. | Notion is a workspace, not a civic workflow. |
| Home hierarchy | **OB:** supplied PDF; **DG:** [Spotify App Store listing](https://apps.apple.com/us/app/spotify-music-and-podcasts/id324684580) | Prioritized return points and concise cards. | Residents can resume without scanning a dashboard. | Attention items first, then quick actions, announcements, recent activity. | Avoid media-feed density and personalization claims. |
| Typography/layout | **DG:** [Apple HIG accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | System text styles and adaptable layouts. | Works with Dynamic Type and established iOS reading behaviors. | SF Pro for all operational UI, content-driven heights. | Existing decorative serif is unsuitable for dense/service content. |
| Color/surfaces | **OB:** current brand green `#0F6E5B`; **PR** | Restrained brand accent plus semantic colors. | Conveys continuity without making color the only meaning. | Green = primary/selected; semantic status always includes icon and label. | Profile accent choices must never affect status colors. |
| Icons/controls | **DG:** Apple HIG; **OB:** PDF icon-plus-label navigation | Familiar symbols with visible labels. | Supports low literacy, VoiceOver, and fast scanning. | SF Symbols plus text; no icon-only essential action. | Custom art is limited to brand/illustration. |
| Forms/selection | **DG:** [Expo DocumentPicker v57](https://docs.expo.dev/versions/v57.0.0/sdk/document-picker/); **PR** | Progressive disclosure and review before commitment. | Prevents incomplete/accidental submissions. | One task per screen, sheet-based pickers, review screen before send. | File limits/types require backend policy. |
| Search/filtering | **DG:** [Spotify Search](https://support.spotify.com/us/article/search/); **DG:** [Notion Search](https://www.notion.com/help/search) | Search plus scoped filters. | Helps large inventories without making default UI complex. | Documents, updates, FAQs, map locations; domain-scoped only. | No advanced syntax/global search at launch. |
| Lists/details | **DG:** [Airbnb Messages](https://www.airbnb.com/help/article/3558); **OB:** PDF status cards | Short summaries, priority grouping, detail history. | Lists remain scannable; details explain state. | One primary fact + status + time in list; timeline only in detail. | Avoid nested-card density. |
| Sheets/dialogs | **DG:** Apple-native convention; **PR** | Contextual sheets, explicit destructive alerts. | Preserves orientation and prevents accidental loss. | Sheet for filters/picker/location source; alert for withdrawal/deletion/discard. | Do not nest sheets or put long forms inside them. |
| Motion/gestures | **DG:** Apple accessibility HIG; **PR** | Native transitions and optional swipe shortcuts. | Orients without spectacle. | Native push/sheet; visible alternative to every swipe action. | No auto-advancing carousels or parallax. |
| Loading/errors | **PR** | Immediate local feedback plus persistent result. | Residents can distinguish “working,” “failed,” and “received.” | Inline recovery; skeletons; durable receipt/status history. | Toasts alone are never critical confirmation. |
| Notifications | **DG:** [Expo Notifications v57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/) | Notification tap can route into an app destination. | Reduces lost context. | Versioned route + record ID; destination refetches before display. | Existing project has no verified remote sender. |
| Accessibility | **DG:** [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility) | Larger text, non-color cues, appropriate labels. | Supports broad resident needs. | VoiceOver contract, 44 pt targets, Dynamic Type, contrast matrix. | Requires device-assisted validation. |
| Perceived performance | **DG:** [Spotify mobile updates](https://newsroom.spotify.com/2026-05-28/playlist-folders-mobile-queue-controls-updates/); **PR** | Visible background progress. | Reduces uncertainty. | Upload queue, freshness time, retry state. | Not proof that Barangayan can perform background work. |

### Patterns intentionally excluded

Avoid a six-label custom tab bar, image-led landing pages, glass/blur-heavy controls, color-only priority, map-first concern reporting, unbounded cards, decorative display typography in forms, and operational claims copied from mockups. These reduce readability or rely on unverified policy/backend behavior.

## 4. Information architecture and core flows

### Route structure

```
Home
├─ Needs your attention
├─ Request a document ──────> Services / Documents
├─ Report a concern ────────> Updates / New concern
├─ Latest announcements ────> Updates / News
└─ Active items ────────────> Services / Request detail or Updates / Concern detail

Services
├─ Document catalog ────────> Detail ─> Form ─> Review ─> Receipt/detail
├─ My requests ─────────────> Request detail/status/payment/pickup
└─ Local drafts

Map
├─ Evacuation centers ──────> Center detail/list/map
└─ Incident discovery ──────> Read-only detail where policy permits

Health
├─ Medical drive list/calendar
└─ Drive detail ────────────> Self-registration/status

Updates
├─ News ────────────────────> Announcement detail
├─ My concerns ─────────────> Concern detail/status
└─ New concern ─────────────> Form ─> Review ─> Receipt/detail

Settings/profile
├─ Identity and verification
├─ Notifications and privacy
├─ Help and support
└─ Security/account actions
```

### Core journey rules

#### Authentication and recovery

1. Welcome explains request, reporting, and update-tracking outcomes.
2. Guest access opens only confirmed-public News, Help, and approved emergency content.
3. Sign-in/create account uses native email/phone/password/OTP input traits and autofill.
4. Recovery never reveals whether an identifier is registered.
5. Restore an authorized deep-link destination or same-account draft after sign-in.
6. A session expiry saves recoverable input, announces why, then returns to sign-in.

#### Document request

1. Catalog list exposes availability, server-provided fee/target/fulfillment only when those data exist.
2. Detail explains requirements in plain language, followed by “Start request.”
3. Verification gate explains exactly what action is needed; do not hide a service without explanation.
4. Form pre-fills profile facts as a read-only summary with “Edit profile.”
5. Attachment control validates local file type/size, uploads with per-file progress, and can retry/remove before review.
6. Review lists exact entered data, attachments, requirements, fee/payment condition, and privacy information.
7. First submit disables duplicate activation and says “Sending request…”.
8. Only a server response produces a durable reference number and “We received your request” receipt.
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
| `submitted` + unpaid payment status | Received - payment needed | Request exists; payment may be required before processing. |
| `submitted` + paid/waived payment status | Received | Request exists; staff has not necessarily started review. |
| `in_progress` | In review | Staff is processing under actual operating rules. |
| `ready_for_pickup` | Ready for pickup | Show only server-authored instructions. |
| `completed` | Completed | Fulfillment is recorded. |
| `cancelled` | Cancelled | Show reason/action if server/policy provides it. |

**Future state requiring a backend contract:** “Needs information.” It may be designed as a persistent action state only after the backend provides a reason, required action, expiry, and resubmission transition.

**Concern UX mapping**

| Existing state | Resident label | Explanation/action |
|---|---|---|
| `open` | Submitted | “We received your concern.” Withdrawal only if server allows it. |
| `in_progress` | Being reviewed or handled | Show a public-safe staff update. |
| `resolved` | Resolved | Show resolution note/date when provided. |
| `withdrawn` | Withdrawn | Retain history and reason. |
| `unresolved` | Closed without resolution | Explain the available reason/escalation path. |

### Notification handling

- Notification center records read state separately from the underlying service record.
- A push payload is a routing hint, never authority. It contains a versioned route and opaque record ID; the app validates authorization and refetches data.
- Mark a notification read only after its destination successfully renders; an unavailable record leaves a readable notification with a Home/Updates fallback.
- Ask for push permission only after a resident has completed a relevant service/report action or intentionally enables it in Settings.
- Use generic lock-screen copy by default: “Barangayan: You have a service update.”

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

Ratios are calculated in sRGB and meet or exceed WCAG AA for their stated use.

| Foreground / background | Ratio | Approved use |
|---|---:|---|
| `textPrimary` / `surface` | 16.8:1 | All text. |
| `textSecondary` / `surface` | 8.2:1 | Supporting text. |
| `textTertiary` / `surface` | 5.0:1 | Metadata at 14 pt or larger. |
| `onPrimary` / light `primary` | 6.4:1 | Buttons/selected controls. |
| `onPrimary` / dark `primary` | 9.1:1 | Buttons/selected controls. |
| White / `danger` | 6.8:1 | Destructive button or solid error badge. |
| White / `info` | 6.7:1 | Solid informational badge. |
| `success` / light `surface` | 5.4:1 | Text/icon, paired with label/check symbol. |

Never place essential text on a photo, gradient, blur, or transparent surface. Under Reduce Transparency, replace decorative translucency with `color.surfaceRaised`.

### Typography

Use system SF Pro for operational content. Map all styles to native Dynamic Type; do not cap scaling. The serif wordmark is a nonessential brand asset only.

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

- Titles wrap to two lines before truncating; body text never truncates.
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
| P1 Filter | Filter button with active count; 2-5 common chips maximum. | Selected/unselected/open/clear. | “Filter, 2 active” value. Reset is always available. |
| P1 Tabs/segments | Content peers within one screen. | Selected. Immediate content update. | Role `tab`, selected trait. Use menu/list at large text instead of clipping. |
| P1 Progress | Determinate bar includes bytes/percent; indeterminate uses native spinner. | Upload/retry/paused/completed. | Numeric value announced. Do not estimate time without a source. |
| P1 Skeleton | Text-line/row geometry only. | Show after 250 ms when final layout is predictable. | Hidden from accessibility. Replacement cannot create layout shift. |
| P1 Empty/error state | Clear title, human cause, recovery action, optional help. | First use, no result, offline, authorization, server failure. | Pass: every blocking state offers Retry, Back, Settings, or Help as appropriate; no raw backend errors. |
| P2 Navigation | Native large/inline navigation title, five labeled tabs, toolbar notification/profile actions. | Selected/unread state. | Badge reads “3 unread updates.” All tab labels remain visible. |
| P2 Transient message | Noncritical, reversible acknowledgement only. | Auto-dismiss 4-6 sec; optional Undo. | Never used for submit receipt, payment, verification, or critical error. |

### Form and upload behavior

- Drafts persist after meaningful changes, app backgrounding, and attachment selection; scope them to account and service/report type.
- Store attachment metadata and completed upload IDs, not unprotected local ID-document copies.
- A draft resume prompt provides Resume and Discard; sign-out warns that unsent private drafts will be removed.
- Keyboard-safe screens scroll the focused field above the keyboard. Use native input types and a visible Done action for numeric keyboards.
- Do not retry ambiguous writes. Query/reconcile server state first; duplicate prevention requires idempotency/authoritative lookup support.
- Destructive actions use confirmation. Undo is offered only for a completed, reversible local operation.

## 7. Screen-by-screen specifications

| Screen | Resident goal | Entry points | Content hierarchy | Primary / secondary actions | States and recovery | Exit/back behavior |
|---|---|---|---|---|---|---|
| Welcome | Understand value and choose access. | First launch/sign-out. | Brand, three concrete outcomes, privacy link. | Sign in; create account; browse public updates. | Cached public content is visibly dated. | Never trap resident in onboarding. |
| Sign in and recovery | Access account safely. | Welcome/session expiry. | Identifier, password, recovery link. | Continue; reset password. | Inline validation/server error; retain safe identifier value. | Back to Welcome. |
| Home | Resume urgent work and learn what is new. | Home tab/deep-link fallback. | Attention items; quick actions; latest announcements; recent activity. | Request document; report concern; open notification center. | Skeleton, empty, stale/offline freshness, retry. | Tab reselect scrolls to top. |
| News list | Read official announcements. | Home; Updates; notification. | Filters, official source, date, latest-first list. | Open item; clear filter. | Empty/no network/stale source. | Restores list position. |
| Announcement detail | Understand an official update. | News/notification. | Title, official source, date, content, related action. | Related service/action where applicable. | Removed/expired/unauthorized item explains unavailability. | Returns to originating list. |
| Document catalog | Find an available document. | Services; Home action. | Search, categories, service rows. | Open document. | Empty/unavailable/load error. | Services root. |
| Document detail | Decide whether/how to request. | Catalog/search/deep link. | Purpose, requirements, availability, source-provided fee/fulfillment/target. | Start request; get help. | Verification/service-availability gate with remediation. | Preserves query/filter. |
| Request form | Supply correct information/files. | Document detail/draft. | Step title, required inputs, attachment section, help. | Continue; save draft; cancel. | Inline validation; upload retry/interruption. | Confirm discard if changed. |
| Request review | Confirm what will be sent. | Request form. | Data summary, files, conditions, privacy/consent if required. | Submit; edit section. | Duplicate prevention and explicit network failure. | Back to editable form. |
| Request receipt/detail | Track the service outcome. | Success; Services; notification. | Status, reference, next action, timeline. | Pay if eligible; view pickup; get help; cancel if allowed. | Stale/missing record route to Services. | Returns to prior Services list. |
| Map/list | Find centers or policy-approved incident information. | Map tab; emergency links. | Search/filter, list-first accessible option, map alternate. | Open location; use current location. | Provider/location denied/stale/offline fallback. | Map root. |
| Health drive list/detail | Find and self-register for a confirmed drive. | Health tab; announcement. | Filter/calendar/list, eligibility, capacity/availability. | Register; view registration. | Capacity/eligibility/duplicate errors; no household applicant option. | Health root or previous detail. |
| Concern form | Report a non-emergency issue. | Home; Updates; empty state. | Emergency caveat, category, details, location, attachments. | Review; save draft. | Permission denial, upload retry, retained draft. | Confirm discard. |
| Concern review/receipt/detail | Submit then understand progress. | Concern flow; Updates; notification. | Reference, status, public-safe update/timeline. | Withdraw if server permits; get help. | Missing/withdrawn/unavailable record. | Returns to My concerns. |
| Updates | Find News and own concerns. | Updates tab; Home/notification. | News/My concerns segment, action-needed first, search/filter. | New concern; open update. | Type-specific empty/retry state. | Tab root. |
| Notification center | Read and act on updates. | Toolbar; push. | Unread first, time grouping, type label. | Open; mark read; mark all read. | Destination unavailable leaves explanatory row. | Dismiss/back returns origin. |
| Profile/settings | Manage identity, safety, and preferences. | Toolbar; gated-flow link. | Identity/verification, notifications, privacy/security, help. | Edit profile; manage settings. | Pending/failed verification points to exact remedy. | Stack back or dismiss. |
| Help | Resolve a problem. | Settings/contextual help. | Search, common tasks, contact route/hours when verified. | Open article; contact support. | Cached articles and contact-unavailable state. | Restores prior query. |

### Home annotated text wireframe

```text
[Large title: Good morning, Maria]                  [Notifications - 2]

[Needs your attention]
[Barangay Clearance | Payment needed | Continue >]
[Streetlight concern | Being reviewed | View >]

[Request a document]                   [Report a concern]

[Latest announcements]                                      [See all]
[Official update / 2 hours ago]
[Road closure on Rizal Street]
[Starts Monday, 8:00 AM. Use the marked detour...]

[Recent activity]
```

Example copy:

- “Your request was received. Reference BRG-4821. We’ll update this page when its status changes.”
- “We need one more document. Open your request to see what to upload.”
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
- **Persistent completion:** server-acknowledged submission/payment/status uses receipt plus activity entry.

### Engineering targets - not measured results

| Target type | Target | Validation method |
|---|---|---|
| Design | Press acknowledgement in <=100 ms. | Physical iPhone interaction recording. |
| Engineering | Meet device refresh cadence: 60 fps on 60 Hz and 120 fps where supported; avoid sustained dropped-frame animation. | Xcode Instruments / React Native performance traces. |
| Engineering | Cached Home useful content <=2 sec p75; uncached useful skeleton <=400 ms p75. | Production telemetry on Wi-Fi and constrained cellular. |
| Engineering | Submit shows confirmed outcome <=10 sec p95 or recoverable pending/retry state. | Staging fault injection and service telemetry. |
| Engineering | No layout shift after skeleton replacement except reserved image aspect ratio. | Compact/large screenshot-video comparison. |
| Engineering | Long lists virtualize; images reserve space; route changes remain tappable. | 500-item fixture and low-memory physical-device run. |

The current repository has no measured production iOS performance or physical-device evidence. These are acceptance targets, not achieved results.

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

The iOS app uses Expo SDK 57 / React Native 0.86. The exact versioned documentation confirms the iOS 16.4+ baseline. Verify each future native capability against its **v57** documentation before use; do not substitute another SDK's API surface. Notifications specifically require app configuration and credentials for remote delivery, and support Router deep-link handling. [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Expo Notifications v57](https://docs.expo.dev/versions/v57.0.0/sdk/notifications/)

## 10. Phased implementation checklist and user-testing plan

| Phase | Scope | Dependencies | Completion criteria |
|---|---|---|---|
| 0. Product contracts | Confirm service/verification policies, owners, status copy, privacy, attachments, content, push scope. | Operations, privacy, backend. | Decision log resolves relevant plan gates; no placeholder fee/timeline/policy ships. |
| 1. Foundation | Tokens, primitives, navigation, auth shell, accessibility harness. | Existing SDK 57 iOS workspace. | Token snapshots and VoiceOver/Dynamic Type/light-dark checks pass. |
| 2. Core documents | Catalog, request form/review, uploads, receipt, tracking. | Catalog/write APIs, storage, idempotency. | Server-confirmed submission, upload retry, duplicate prevention, request-state staging tests pass. |
| 3. Core concerns | Concern form/review, attachments, location fallback, tracking. | Incident APIs/storage/visibility policy. | Emergency caveat, denied-permission route, withdrawal mapping, no-false-success tests pass. |
| 4. Updates/maps/notifications | News, activity, notification center, accessible map/list, guarded deep links. | Inbox API; provider approvals; APNs/sender if push launches. | Stale/deleted/auth-expired route tests pass; remote push stays off until sender passes. |
| 5. Health/profile/help | Verification, health registration, settings, help, privacy polish. | Verification, health authorization, content/support contracts. | Sensitive-data audit, recovery, self-only health flow, accessibility regression pass. |
| 6. Pilot/release | Telemetry, TestFlight, content governance, support operations. | Apple/EAS/device/backend access. | Measured targets, pilot findings resolved, release checklist signed. |

### User-testing plan

| Assumption | Task | Participants | Evidence that changes the design |
|---|---|---|---|
| Five tabs are comprehensible. | Find a previous clearance request and explain its next action. | 5-8 residents across age/digital confidence. | Fewer than 80% unaided success or confusion between Services and Updates. |
| “Received” is not mistaken for approved. | Submit a request and explain what will happen next. | Residents familiar with barangay services. | Material confusion among receipt, payment, approval, and completion. |
| Attachment/location recovery works. | Report blocked drainage after denying location and photo permission. | Smaller/older iPhone and limited-data users. | Resident cannot complete using typed landmark/files. |
| Status language is trustworthy. | Compare payment needed, in review, ready for pickup, closed without resolution. | Residents and front-desk staff. | Users cannot name the needed action or staff cannot map copy to operations. |
| Large text preserves task completion. | Complete a document request at Accessibility XXL. | Dynamic Type and VoiceOver users. | Any clipped text, unreachable action, duplicate focus, or unannounced error. |
| Notification privacy is acceptable. | Review lock-screen examples and open an expired update. | Residents who share devices. | Sensitive disclosure or inability to recover from unavailable record. |

## Design-to-plan traceability

This document supplements, rather than replaces, [Resident_iOS_Implementation_Plan.md](Resident_iOS_Implementation_Plan.md).

| Implementation-plan finding | Design-system response |
|---|---|
| Existing iOS app is partial and several routes are intentionally gated. | Every capability has prerequisite-unavailable, loading, error, and recovery states; design never visually promises gated capability. |
| Remote push sender is absent. | Notification center/in-app updates are primary; no “real-time” or SMS promise. |
| Document fee/payment states are authoritative and QR Ph is gated. | Receipt separates request acknowledgement from payment outcome; no pre-authoritative success animation. |
| Existing concern/public map scope and moderation are unconfirmed. | Concern visibility is disclosed before submission; public map is secondary and policy-gated. |
| Household, private-ID, check-in, medical, export, deletion, and tenant contracts require staging proof. | Profile/health/emergency flows use explicit unavailable/action-needed state until gates pass. |
| Map providers and safety suitability require approval. | Map always has a list/manual-address alternative; route guidance does not imply safety verification. |
| iOS testing is unverified on current Windows environment. | Performance/accessibility/device requirements are targets with named validation, not claims of achievement. |



