# Admin Web (`apps/admin-web`) UI Inventory — AUDITED & MERGED (2026-10-24)

Supersedes nothing: the original `Admin_Web_UI_Inventory_2026_10_24.md` is untouched. This file is the audited merge.
Source paths are relative to `apps/admin-web/src/` unless noted. `(admin)` = `app/(admin)`.
Row tags: **[added]** missing from the first inventory; **[fixed]** present but wrong or incomplete, corrected here; **[removed]** listed in the first inventory but not reachable or not in code (kept as a struck row so the change is visible). Untagged rows matched the first inventory (condensed here, no loss of content intended).

**Independence caveat (read first).** The same assistant session wrote the first inventory, so my memory of it was not blank. I mitigated this by re-deriving everything from fresh greps (§12 lists them) and only then diffing. The checks that produced `[fixed]`/`[removed]` tags are re-greps, not recall.

---

## 0. Reading guide, access model, cross-cutting variants

### 0.1 Access model [fixed]
There is **one admin role** and no per-role UI. The first inventory said so; the audit adds the real gate matrix (also in §13.2):

| Gate | Where | Effect when blocked |
|---|---|---|
| `profiles.role === 'admin'` and `deleted_at IS NULL` (`.single()`) | `(admin)/layout.tsx` — covers **every** admin route | Redirect `/login`. No "forbidden" screen exists. |
| Same check repeated | `requests`, `transactions`, `residents`, `staff`, `incident-reports`, `health`, `health/applicants`, `households-residents`, `archive/[screen]` pages | Redirect `/login` (archive also if `barangay_id` is null) |
| Layout-only (no page-level role check) [added] | dashboard, services, services/sla, announcements, waste-management, hub, evacuation-centers, evacuation-routing, emergency-qr, faq, terms-privacy, about-us, settings, theme, incident-map, search, archive index | Rely on the layout. Several use `user!.id` or `.single()` without handling failure (see §13.4). |
| `activeAdmin()` — also checks the staff roster | `/profile` only | Admin whose `barangay_officials` row is inactive, soft-deleted or in another barangay → redirect `/login`; with the profile feature on, `admin_profile_access` RPC 42501 → `/login` |
| MFA assurance (`aal2`) | `/profile` only | `nextLevel=aal2` and `currentLevel≠aal2` → "Verify admin sign-in" challenge instead of the workspace |
| Server actions `mutateAdminRecord`, `loadAdminRecordOptions`, `loadRequestReview` | `actions/*` | Throw/return "Your session expired. Sign in again." / "An active administrator account is required." → shown as the sheet/dialog error banner and error toast |
| `/api/admin/residents`, `/api/admin/staff/invite` | `app/api/admin/*` | JSON 401 "Not signed in." / 403 "Admin access required." / 400 validation → surfaces as the form's error toast |
| `/api/search`, search record page | `lib/search/server.ts` | 401 "Please sign in again to search." / 403 "An active administrator account is required." / 503 "Search could not load. Please retry."; UI shows "Sign in" button |
| Self-protection | `record-workspace.tsx`, `staff-table.tsx` (`notSelf`) | Own staff row: inline edit disabled for name/role/mobile/address/hired; Edit, Archive, Delete disabled with tooltips; Edit disabled in sheet |
| Resident gate | `app/resident/layout.tsx` | No session → `/login`; role ≠ resident → `/dashboard` |

### 0.2 Cross-cutting variants [fixed — breakpoints expanded]

| Variant | Source | Values |
|---|---|---|
| Theme | `components/ui/theme-controller.tsx` | `light` / `dark` (`.dark` class on `<html>`; stored choice else `prefers-color-scheme`); applies everywhere incl. login/auth pages and Leaflet popups (`globals.css`). |
| Accent / font | `accent-controller.tsx`, `font-controller.tsx` | Preset + custom hex (max 10 saved); `FONT_OPTIONS`. |
| Sidebar | `admin-shell.tsx` | Expanded 244 px / collapsed 72 px (60 px on ≤700). Not persisted. |
| Breakpoints [fixed] | CSS modules (grep `@media`) | Header/sidebar `admin-navigation.module.css`: 701–1100 grid, ≤700 overlay sidebar, ≥1101 centred search. Profile 850/600/420; profile-proof 900/480; search 900/600; settings 800/480; about-us 1000/700; emergency-qr 1100/800/480; evacuation-routing 1180/1000/600; incident-map 1100/700/360; content-workspace 767/639/479; side sheets (`content-forms`, `record-sheet`, `request-review`, `content-edit-dialog`) ≤639; operational/incident/resident record sheets ≤639 and ≤379; resident ID review 479/359; pager first/last hidden <480 (`globals.css`). Tailwind `sm:` grids in forms (grid-cols-1 → 4) and notifications drawer. |
| Motion / contrast | `globals.css`, `editable-data-table.module.css` | `prefers-reduced-motion` disables transitions/smooth scroll; `forced-colors: active` styles exist. No `@media print`. |
| Toasts | `components/ui/sonner.tsx`, `lib/notify.ts` | success / error / warning / info; top-centre; max 3; under header (`--aw-toast-top`) or 16 px on auth pages. |
| Tooltips [added] | Native `title=` only (no tooltip component) | Collapsed nav items, row action icon buttons ("View Details: {record}"), disabled workflow buttons (e.g. "Resume processing in the request details…"), pager buttons. |
| Keyboard [added] | various | Escape closes popovers, drawers, dialogs and cancels cell edits; Enter edits a focused cell; ArrowDown/Up opens the account menu; ↑↓ Enter Esc in search suggestions. No global shortcuts. |
| Realtime silent refresh [fixed] | `.channel(` in requests-table, incident-table, drive-table, applicants-table, evacuation-center-row, emergency-row, about-us-form, terms-privacy client-wrapper, emergency-qr client-wrapper, audit hooks | Data changes made by another admin re-render without a toast (first inventory only listed Requests). |

---

## 1. Auth & standalone routes (outside the admin shell)

| Name / type | Route | Source | How to reach | States / variants |
|---|---|---|---|---|
| **Root redirect** | `/` | `app/page.tsx` | Visit `/` | → `/dashboard` (then layout → `/login` if signed out). |
| **Login** | `/login` | `app/login/page.tsx`, `login-form.tsx` | Visit; redirected as signed-out/non-admin | Default; password-notice banner by cookie `barangayan-profile-password-notice` = `changed` / `cleanup_pending` / `review_required`; submitting "Signing in…"; inline red error; toasts "Login failed: …", "Welcome back", network-failure error; resident login → `/resident` silently. |
| **Forgot password** | `/forgot-password` | `app/forgot-password/page.tsx` | Login → "Forgot Password?" | Default; "Sending…"; inline error + error toast; warning toast; success toast → Reset. |
| **Reset password** | `/reset-password?email=` | `app/reset-password/page.tsx` | After Forgot, or direct | Email or "your email" text; 45 s resend countdown → "Resend Code"/"Resending…"; per-field errors (`newPasswordSchema`); inline error; toasts for validation, success, resend, warnings; "Updating…". Wrapped in `Suspense` (blank fallback). |
| **Email-confirmation callback** | `/profile/security-callback` | `app/(profile-auth)/profile/security-callback/page.tsx` | Link from sign-in-email change | Seven status messages (checking, failed/expired, sign-in required, pending, checked, expired session, unavailable) + toasts only if URL had params; **no admin shell**. |
| **Profile proof window** | `/profile-proof` | `app/profile-proof/*` | Popup from Profile | Gate texts (flag off / bad params); sign-in, email-code, MFA, verified, busy panels; alerts (opener missing, cleanup failed); 5-minute auto-retire. |
| **Resident portal** (9 screens) | `/resident/**` | `app/resident/**`, `components/resident/resident-shell.tsx` | Resident login | Home, Profile (+ID upload), Requests list/new/detail (cancel confirm, pickup choice, SLA status), Reports list/new. Details in §11. |
| **Default Next 404** [fixed] | any unknown URL, `/archive/<bad>`, resident `/resident/requests/<bad id>` | none (`notFound()` calls in `archive/[screen]`, `resident/requests/[requestId]`) | Visit | Default Next.js 404 — **inside the admin shell** for `/archive/<bad>` (no `(admin)/not-found.tsx`), inside the resident shell for resident requests, bare for unknown top-level URLs. Not customised. |
| **Search 404** | `/search/[category]/[recordId]` | `(admin)/search/not-found.tsx` | Unknown record, category `all`, non-UUID id | "Record unavailable…" + "Back to search". |
| **Error boundaries** | search, profile segments | `search/error.tsx`, `profile/error.tsx` | Server error | Search: "Could not load this record" + "Try again"; Profile: "Admin profile unavailable" + "Retry profile". No global/segment error for any other route [added: those errors fall to Next's default error page]. |
| **Legacy redirect** | `/requests/[requestId]` | `requests/[requestId]/page.tsx` | Old link | → `/requests?record=<id>` (opens the request side sheet). `loading.tsx` there is a `detail` skeleton, only visible for a moment. |
| **SLA report** (orphan) | `/services/sla` | `services/sla/page.tsx`, `service-sla-report.tsx` | URL only (not in nav) | Window form, invalid-range alert, loading, error+Retry, stat grid ("No samples" variants), attention list, threshold alerts + empty texts. Links into `/requests?record=`. |
| **Route-level loading screens** [added] | per segment | `(admin)/loading.tsx` (table skeleton, default for every route without its own), `dashboard/loading.tsx` (dashboard), `incident-map/loading.tsx` (`MapLoading`), `profile/loading.tsx`, `settings/loading.tsx` (settings), `search/loading.tsx` ("Loading search content…"), `archive/loading.tsx`+`[screen]/loading.tsx`, `emergency-qr/loading.tsx` (qr), `requests/[requestId]/loading.tsx` (detail) | Slow navigation | `PageSkeleton` variants in use: `table`, `dashboard`, `qr`, `detail`, `settings`. Variant `map` exists in `page-skeleton.tsx` but **no route uses it** (map route uses `MapLoading`). |
| **API routes** | `/api/admin/residents`, `/api/admin/staff/invite`, `/api/search` | `app/api/**` | n/a | JSON only (status codes in §0.1). |

---

## 2. Layout & persistent chrome

| Name / type | Parent | Source | How to reach | States / variants |
|---|---|---|---|---|
| **Admin shell** | all `(admin)` | `(admin)/layout.tsx`, `admin-shell.tsx` | Admin session | Header + sidebar + scrolling main (padding 32 px, light `zinc-50` / dark `black`); wraps the profile navigation guard. |
| **Header** | shell | `header.tsx` | always | Hamburger (`aria-expanded`), logo + "{barangay} admin", search, bell, account menu; 3 layouts by width. |
| **Sidebar** | shell | `sidebar-nav.tsx` | always | 5 groups (Overview, Operations, Directories & Mapping, Emergency & DRRM, Administration) + Theme row (with toggle) + Logout. Expanded/collapsed, active, hover, link-pending spinner. Note: "Health" is exact-match; "Archives" auto-scrolls into view. |
| **Breadcrumbs** | — | — | — | None exist. |
| **Account menu** | header | `header.tsx`, `dropdown/admin-action-menu.tsx` | Avatar button | Theme, Logout (destructive); avatar photo / initial / error fallback. |
| **Notification bell + popover** | header | `header.tsx` | Bell | Badge (0 hidden, "99+" cap); mark-all-read (only if unread); "More"; filter chips All, Unread + 20 modules; loading / empty / filtered-empty; unread vs read rows. |
| **Notifications drawer** | header | `notifications-drawer.tsx`, `notification-item.tsx`, `date-range-picker.tsx`, `use-audit-log-browser.ts` | Bell → More | Search, module chips (`ScrollableChipRow`), date-range popover, layout views Details/List/Tiles/Content, 1–N columns, "Mark all as read", "Clear filters", Load more, loading/error/empty/filtered-empty. [fixed] Toast set: "Matching notifications marked as read.", plus bell hook's "All notifications marked as read." and the two mark-read error/warning pairs. |
| **Notification detail panel** | drawer | `notification-detail-panel.tsx` | Click a row | What changed / Details / Identifiers (copy) / Raw audit record; slide in/out. **[added] Item labels** come from `buildDisplayLabel`: "{Created\|Updated\|Deleted\|Status changed\|Logged in\|Logged out}: {entity label} — {admin name}"; unknown actions are shown raw; items link to the module page (`/requests?record=<id>` for service requests; `System` has no link). |
| **Global search (navbar)** | header | `navbar-search.tsx`, `use-admin-search.ts` | Type ≥2 chars | Suggestion listbox, grouped hits, See all results, Searching…, Try again/Retry, partial-failure text, Sign in (session), history + Clear history, clear (×). Error toasts "Could not refresh search results…". |
| **Profile-navigation guard dialog** | any route | `profile-navigation-guard.tsx` | Unsaved profile edit + nav/logout; or busy op | "Discard unsaved profile changes?" / "Please wait for the current operation". |
| **Toaster** | root | `sonner.tsx` | any action | See §0.2. |
| **Global banners** | — | — | — | None. |

---

## 3. Shared building blocks (screenshot states repeat in every table screen)

| Name / type | Source | States / variants |
|---|---|---|
| **Table browse panel** | `table-browse-panel.tsx`, `table-browse-controls.tsx`, `table-pagination.tsx`, `segmented-filter.tsx`, `profile-table-panel.tsx`, `use-pilot-table-browse.ts`, `lib/admin-tables/*` | Search; Sort by + Direction (icons per category text/date/number/boolean); category select; segmented tabs; page action; pager (10/20/30/50/100). Pending (progress bar, inert body, "Updating results…"); error row + Retry. URL-driven (`q`, filters, `sort`, `dir`, `page`, `pageSize`; invalid values fall back to defaults). **[fixed] Empty vs no-results**: the tables use a single `emptyLabel` (text in §5/6), so "no data" and "no search match" look the same; only content catalogs (§5–8) distinguish them. **No bulk-select, no export anywhere** (searched `select all`, `checkbox` in tables, `csv`, `export`, `download` — only QR PNG download exists). |
| **Summary cards** | `summary-cards.tsx`, `pilot-summary.tsx`, `profile-table-summary.tsx`, `operations-table-summary.tsx` | Per-screen counts; error banner + "Retry summary". |
| **Editable data table** | `editable-data-table.tsx`, `table-scroll-area.tsx`, `row-context-menu.tsx` | Resize handles, frozen columns, cell edit (text/select/datetime/date), "Save row"/"Cancel edit"/"Retry save", cell error alert, saving state, `canEdit=false` cells (read-only, no edit affordance — e.g. own staff row, v2 request resident/document), right-click context menu ("Row actions"; mirrors action buttons incl. hidden "Edit (view details)"), toasts. |
| **Row actions cell** | `record-workspace.tsx` | Edit (table, green), View Details (blue), Archive/Restore (amber), Delete (red); self-protection disabling. Cell min-width grows with status (240/420/560/720). |
| **Record side sheet** | `record-workspace.tsx`, `content-create-panel.tsx` (`ContentSideSheet`) | Modes details/edit/archive/restore/delete; loading, load error + "Retry details", unavailable, "Archived record" banner, success/error banners, 15 s timeout. Per-table bodies. **[added] Edit form** validation and field sets are in §3.1. |
| **Archive/Restore/Delete confirmation** | `record-workspace.tsx` + `table-detail-dialog.tsx` | Titles, copy, buttons per mode; "Working…"; protected record disabled. **[added] Standalone path**: opened from the row icon without the sheet; while the record loads or fails it shows the load/error body inside the dialog with Cancel. |
| **Content create side sheet** | `content-create-panel.tsx` | Trigger button(s); draft-preserving; Tab trap; "Close form". |
| **Content edit dialog** | `content-edit-dialog.tsx` | Used by Announcement, Evacuation center, FAQ, Hub, Service, Waste zone, Waste schedule rows. |
| **Content workspace pattern** | `content-workspace.tsx` | Summary tiles, search, status chips with counts, "{n} of {total}", "Reset filters", empty state (first-use vs no-match with "Clear filters"). |
| **Two-step ConfirmButton** [fixed — full list] | `confirm-button.tsx` | Used at: announcement archive; evacuation-center archive; FAQ archive/restore/delete; hub archive; service archive; waste zone/schedule/dumping-report archive; Applicants "Cancel Registration" (hidden when status is cancelled or attended); Transactions refund; resident "Cancel this request?" (resident portal). Busy "Working…". Error toast "The action could not be completed. Check your connection and retry." (`use-row-action.ts`). |
| **Dropdowns** | `components/admin/dropdown/*` | `AdminSelect` (many `kind` icon sets), `AdminSuggestions` (Transactions reference autocomplete only), `DropdownSurface`, `AdminActionMenu` (account menu only), "No options available". |
| **Skeletons/spinners** | `components/loading/*` | Variants per §1 loading row. |
| **Status pills** | `status-pill.tsx` | submitted, in_progress ("Processing"), ready_for_pickup, completed, cancelled, pending, paid, failed, expired, waived, refunded; unknown → raw grey. **[added]** `cancelled` payment status has a record-edit option but pill shows red "Cancelled" (shared key). Other badge systems: resident ID chip colours, `ContentStatus` Active/Inactive, `ScoreBadge`, notification dots. |
| **Dead code (not reachable)** [removed] | — | ~~`IncidentDetailModal`~~, ~~`DriveDetailModal`~~, ~~`ApplicantDetailModal`~~, ~~`MemberFormModal`~~ (all four have **no importers**), ~~`hooks/use-households.ts`~~, ~~`components/admin/data-table.tsx`~~, ~~`static-placeholder.tsx`~~, ~~`table-browse-layout.ts`~~ — the first inventory described the first four as live overlays; their strings ("Open in Google Maps ↗", "Title cannot be empty.", "Enter an age between 0 and 130.", "Household member added/updated/removed") never render. Detail/edit for those entities is the generic `RecordSheet`. |

### 3.1 Record-sheet edit forms and validation [added]
Fields come from `lib/admin-tables/record-config.ts`; the form fieldset is two-column on ≥640 px.

| Table | Editable fields | Notable variants |
|---|---|---|
| requests | Reference*, Resident*, Document type*, Status*, Notes, Payment method*, Payment status*, Submitted on* | **v2 contract**: Resident/Document read-only; Status options limited to current/next/cancelled; **"Status change reason"** textarea appears only when switching to cancelled; error "Enter a reason for cancelling the request."; extra helper texts ("Resident and document are kept…", "Payment status edits update payment records. Use the Refund action…"). Hint under actions when no editable fields: "Use the review controls above to change workflow details." |
| transactions | Date created*, Request reference*, Resident*, Document type*, Amount (centavos)*, Method*, Status* (pending/paid/failed/expired/cancelled/refunded), Payment source, Collected by | Amount field **hidden once status ≠ pending**; if none editable: "Completed payment amounts are kept as ledger records." |
| residents | First/Last*, Middle, Suffix, Sex, Email, Mobile, Birth date, House no., Street, City, Employment status, Occupation | Embedded ID review; messages "Enter a valid email address.", "Enter an 11-digit mobile number starting with 09.", "Birth date cannot be in the future." Resident-sheet extra: "ID status saved. Could not refresh the resident details…" |
| incidents | Title*, Description, Address, Category, Reporter, Coordinates* ("lat, lng"), Confirmations*, Submitted on*, Specific area details, Status* | "Enter coordinates as latitude, longitude within valid ranges." |
| health | Title*, Category*, Date*, Location*, Start*/End* time, Eligibility*, Stock label/unit*, Total (≥1)*, Remaining*, Active | "Remaining stock cannot exceed total stock.", "End time must be after start time." |
| applicants | Age (0–130)*, PWD, Comorbidities (list), Prior dose date, Status* | "Enter a valid list of comorbidities." |
| households | Name*, Relation*, Member role* (member, head, spouse, child, parent, sibling, grandparent, grandchild, other) | |
| staff | Full name*, Mobile, Address, Official role*, Hire date, Active | Disabled for own record |
| Generic errors | | "Enter valid changes.", "This field cannot be edited here.", "{Field} is required.", "{Field} is too long.", "Select a valid {field}.", "There are no editable changes to save.", server: "This record has related records. Resolve those records before deleting it.", "This record changed. Reload the details before trying again.", "A record with these values already exists.", "You do not have permission for this action, or this field requires its dedicated workflow.", "No record was changed. Reload the details and check your access." |

---

## 4. Dashboard / Overview

| Name / type | Route | Source | How to reach | States / variants |
|---|---|---|---|---|
| **Dashboard** | `/dashboard` | `dashboard/*` | Nav; post-login | Heading; 4 KPI link cards (Suspense skeletons); "Needs attention" (hidden when empty; overdue/nearing legacy-hours requests, max 5; failed payments, max 5; count badge); Recent Requests / Recent Transactions (8 rows, empty rows "No requests yet." / "No transactions yet."); route loading skeleton. No charts/maps. **[added]** KPI links carry `?tab=` filters; attention rows link to `/requests?record=<id>` and `/transactions?tab=failed`. |
| **Profile** | `/profile` | `profile/*` | Nav; Header avatar | Gate states: feature-off notice; MFA challenge; workspace (view/edit, saving, conflict, reload, access expired, staff info or empty, security: credentials gated vs enabled, associated resident none/linked/unavailable/error, dialogs). **[added]** Profile-security dialogs are `ProfileDialog` modals titled "Change admin sign-in email" / "Change admin password" (not inline forms); avatar editor dialog; unlink confirm dialog; redirect to `/login` if roster/MFA/RPC gates fail (§0.1). |
| **Theme** | `/theme` | `theme/*` | Nav; account menu | Appearance (Light/Dark), Accent (presets, custom hex, saved colours ≤10 with limit tooltip "You can save up to 10 custom colors"), Typography, note; toasts. Falls back to local-only when not signed in ("Appearance updated locally…"). |

---

## 5. Operations: Services, Announcements, Requests, Transactions

| Name / type | Route | Source | How to reach | States / variants |
|---|---|---|---|---|
| **Services catalog** | `/services` | `services/*` | Nav | Create button/sheet, archive link, summary, search + All/Active/Inactive, rows (details expander, Edit dialog, Archive confirm, v1 "Previous catalog format" banner), empty states, **load-failure page** ("Unable to load the document catalog…" + Retry link). **[fixed]** Page has no role check (layout-only). |
| **New/Edit service form** | `/services` | `document-type-form.tsx` | Create or row Edit | Name, Description, workflow (General request…), Citizen's Charter fields, Processing Target (minutes), Purposes (add/remove, explanation required), Requirement rules, Pricing (fixed vs tax-code at pickup; business-document hint), aggregated + per-field errors (`"{label}: {message}"`). |
| **Announcements** | `/announcements` | `announcements/*` | Nav | Create sheet, summary, search + category chips, Edit dialog, Archive confirm, toasts. |
| **Requests** | `/requests` | `requests/*` | Nav; dashboard KPIs; `?tab=active\|pickup…` | Summary; tabs All/Active/Processing/Ready for Pickup/Completed/Cancelled (default Active); document select; 7 sorts; "+ Add Request"; inline editing; realtime; options-error banner; empty "No requests in this view."; archive link. |
| **Add Request form** | `/requests` | `requests-table.tsx` | "+ Add Request" | Reference (optional), Resident, Document type (v1 only), Status, Payment (Pending/Paid/Waived), Submitted date, Notes; "Create Request"/"Creating…"; toasts. |
| **Request workflow buttons** | `/requests` row, request sheet | `request-status-actions.tsx` (v1), `request-fulfillment-panel.tsx` (v2) | Row Actions / Manage request | By status (v1): submitted → Move to Processing; in_progress → Mark as Ready for Pickup (disabled when v2 SLA not running); ready_for_pickup → Mark Payment Collected (pickup & unpaid; needs assessed amount) + Mark as Completed (v2 needs paid/waived/zero fee); completed+unpaid pickup → only Mark Payment Collected; cancelled → none. Cancel Request → inline reason → Confirm/Back. "Updating request…". v2 panel: fee-assessment `pickup_due` → "Amount collected (PHP)"; SLA `pre_processing`/`running`/`paused`/`ready`; Pause (reason) / Resume. |
| **Request record review (side sheet)** | `/requests?record=<id>` [fixed — reach step] | `request-record-review.tsx`, `request-review.tsx`, `request-linked-record-sheet.tsx` | Row eye; dashboard, search, notification and SLA-report links all go through `requestRecordHref` → `/requests?record=<id>`; closing the sheet removes the param | Loading / error+Retry; hero + 2 pills; section nav (anchors); Manage request; Resident; Payment (+`PaymentRefundAction`); submitted info + attachments; ID evidence (or "Referenced ID evidence is unavailable."); Requirements; Purpose/Requester notes; Status History; `AgencySlaStatus`. Archived request shows generic details. |
| **Transactions** | `/transactions` | `transactions/*` | Nav; dashboard `?tab=paid\|failed` | Summary (PHP); tabs; method select; 10 sorts; "+ Add Transaction" ; options-error banner; empty "No transactions in this view." |
| **Add Transaction form** | `/transactions` | `transactions-table.tsx` | "+ Add Transaction" | Request reference with `AdminSuggestions` ("Reference suggestions", "Looking up request…"), auto-filled fields, Amount (₱), Method, Status, source id (`src_…`); toasts. |
| **Refund control** [fixed] | Transactions row and request review | Transactions has its **own** ConfirmButton refund (`transactions-table.tsx` ~l.555); request review uses `payment-refund-action.tsx` | qrph payments only (`paid`/`refunded`) | none → "Refund" → "Refund full amount?"; `failed` → pill + "Retry Refund"; pending/processing/refunding → pending pill + claim link; `refunded` → pill + claim link. Both show the PayMongo success toast. Pickup payments never show it. |

---

## 6. Directories & Mapping

| Name / type | Route | Source | How to reach | States / variants |
|---|---|---|---|---|
| **Resident directory** | `/residents` | `residents/*` | Nav | Summary (9 cards), 5 tabs, ID-presence select, 8 sorts, 19 columns, "+ Add Resident" (invite form: Email*, Full Name*, Mobile, Address; "Send Invite"/"Sending…"), empty "No residents found." |
| **Resident record sheet** [fixed] | `/residents` → eye | `record-workspace.tsx`, `resident-directory.tsx` | Row View Details | One scrolling sheet with an **anchor-link nav** (Overview, Household, ID review, History) — not tabs. Sections: personal, household members ("No household members recorded."), ID review, request history ("Loading…", "No service requests yet."). Edit mode adds embedded ID review + note. |
| **ID status chip + ID review dialog** | `/residents` cell; sheet | `resident-id-review.tsx` (`ResidentIdStatusCell`, `ResidentIdReview`) | Click chip | Statuses `null` "No ID", `pending`, `verified`, `verification_failed`, "Evidence repair required"; loading, error+"Reload ID", no-submission text, documents (loading/none/partial error), decision select ("Verified ID" only when pending; revoke wording when verified), required reason, "Save ID status"/"Updating ID status…", already-reviewed message, toasts. The dialog title is "Update ID status for {name}". |
| **Incident reports** | `/incident-reports` | `incident-reports/*` | Nav; map popup link `?tab=open&q=` | Summary (6), tabs (default Open), category select, 7 sorts, columns, "+ Add Incident", pending text "Updating incident reports…", empty "No incident reports found." |
| **Incident status actions** | row | `incident-actions.tsx` | Row Actions | open → In Progress, Unresolved, withdraw, Remove; in_progress → Resolved, Unresolved, withdraw, Remove; resolved/withdrawn/unresolved → Remove only; inline "Remove this incident?" confirm; "Updating incident…". |
| **Incident record sheet** [fixed] | `/incident-reports` → eye | `incident-record-details.tsx` (+ generic edit) | View Details | Hero (title, status, category, time, "{n} resident confirmation(s)"); anchor nav Overview/Photos(count)/Location/Reporter; photo **gallery** (large photo, "Photo n of m", "Open original", thumbnail buttons "View photo n" when >1; empty "No photos attached"); Location (address, specific area, coordinates or "No map pin provided"); Reporter or "Anonymous report". No Google-Maps link, no lightbox. Edit uses the generic form (§3.1). ~~"Incident detail modal"~~ [removed]. |
| **Incident map** | `/incident-map` | `incident-map/*` | Nav | Header counts; Incidents/Evacuation segments; search; category pills (incidents layer; loading variant); Leaflet map with boundary, clusters, popups; full-screen control + failure toasts; activity indicator; empty overlay; `MapLoading`. **[added]** `?tab`, `?category`, `?q` are accepted but ignored (`void searchParams`), so deep links from other screens do not pre-filter the map. |
| **Health drives** | `/health` | `health/*` | Nav | Summary (6), tabs (default Upcoming), type select (10 types), sorts, "+ Add Drive", realtime, empty "No medical drives found." |
| **Add Drive form** | `/health` | `drive-table.tsx` | "+ Add Drive" | Title, Category, Date, Location, Start/End, Stock total/unit/label, Eligibility; validation toasts. |
| **Drive record sheet** [fixed] | `/health` → eye | `operational-record-details.tsx` ("Health record": Drive & schedule / Eligibility / Stock & registrations / Record history) | View Details | Anchor-nav sections; edit via generic form with health validation (§3.1). ~~"Drive Details" modal~~ [removed]. |
| **Medical applicants** | `/health/applicants` | `health/applicants/*` | Nav | Summary (6), tabs (All default), type select, sorts, "+ Add Registration", realtime, empty "No registrations found." |
| **Register form** | `/health/applicants` | `applicants-table.tsx` | "+ Add Registration" | Drive*, Resident*, age, Is PWD, Comorbidities, Prior dose date; toasts. |
| **Applicant record sheet + cancel** [fixed] | `/health/applicants` | `operational-record-details.tsx` ("Medical applicant record": Registration / Medical information / Medical drive / history) | View Details | Row workflow button "Cancel Registration" → "Cancel registration?" confirm, **hidden for cancelled/attended**. ~~"Registration Details" modal~~ [removed]. |
| **Waste management** | `/waste-management` | `waste-management/*` | Nav | Two create buttons (zone, schedule), summary (3), Zones↔Schedules switch, search, status chips, zone rows (priority score, Inactive, edit/archive/activate toggle, nested schedules), schedule rows, empty states, **Illegal dumping reports** section (score badge with high-priority styling, zone, open→in progress→resolved, archive, empty "No dumping reports"). Trash section only if trash-related categories exist; otherwise the list stays empty. |

---

## 7. Emergency & DRRM

| Name / type | Route | Source | How to reach | States / variants |
|---|---|---|---|---|
| **Hub** | `/hub` | `hub/*` | Nav | Create sheet, summary, search + All/Guidelines/Hotlines, Inactive tag, Edit dialog, Archive confirm, realtime refresh. |
| **Evacuation centers** | `/evacuation-centers` | `evacuation-centers/*` | Nav | Create sheet, summary (3), search + chips, occupancy / "At capacity", Archived tag, Edit dialog, Archive confirm, realtime. |
| **Evacuation routing** | `/evacuation-routing` | `evacuation-routing/*` | Nav | Page-level info/error notices; overview card; 4 numbered sections (workspace map, active closures, centers & entrances, recent changes); closure form; reopen form; entrance set/clear; clear-entrance dialog; map editable vs preview; toasts. |
| **Emergency QR** | `/emergency-qr` | `emergency-qr/*` | Nav | Header; **two toggle buttons** (Instructions / QR Codes, `aria-pressed`, no tablist role) [fixed]; realtime refresh; qr skeleton. |
| **QR Codes tab** | same | `qr-codes-tab.tsx`, `qr-code-display.tsx` | QR Codes | Select Center, Regenerate All, QR card, Save QR, Download PNG, payload copy, empty state, "QR not ready". |
| **Instructions tab + editor + preview** | same | `qr-instructions-*.tsx`, `mobile-preview-card.tsx` | Instructions | Why Scan / How It Works, visibility toggle, Edit modal (title, body, steps, icon, colours), resident preview card. |
| **Households & residents** | `/households-residents` | `households-residents/*` | Nav | Summary (8), tabs, relation select, sorts, columns, primary "Scan Family QR / Attendance", "+ Add Member" form, session-lost banner, options-error banner, empty "No household people found." |
| **Family attendance dialog** | same | `attendance-dialog.tsx`, `family-qr-camera.tsx` | Attendance button | Center select (+error/empty), camera view (permission denied, startup timeout, unsupported), manual resident path, loading/confirming, people checklist, review step, receipt (4 outcomes), pending-retry, stale, refresh, selection errors. [added] error messages: "This is not a valid Family QR code…", "Choose at least one available person.", "Select only people with an active stay for checkout.", "Choose an active evacuation center for arrivals.", "A selected person is checked in at another center. Check them out first." |

---

## 8. Administration

| Name / type | Route | Source | How to reach | States / variants |
|---|---|---|---|---|
| **Staff & admin accounts** | `/staff` | `staff/*`, `api/admin/staff/invite` | Nav "Staff member" | Summary (3), tabs All/Admins/Staff, official-role select (10 roles), sorts, columns, "+ Add Staff" → invite form (Email, Full Name, Barangay Role, Mobile, Address; "Invite Account"/"Inviting…"; success toast; API 401/403/400 errors), empty "No staff accounts found.", **own-row restrictions** (§0.1) [fixed]. |
| **FAQ content** | `/faq` | `faq/*` | Nav | Create sheet, summary, search, Published/Archives/All, category select, row states Published/Draft/Archived; Edit dialog; Archive; Restore; Delete forever (archived rows). |
| **Terms & Privacy** | `/terms-privacy` | `terms-privacy/*` | Nav | Document switch = two `aria-pressed` buttons (Terms of Service 01 / Privacy Policy 02) [fixed]; Edit/Preview toggle, Markdown hint, Published switch, Save; realtime refresh; toasts/errors. |
| **About Us** | `/about-us` | `about-us/*` | Nav | [fixed] **Edit mode** (anchor nav 01–04: Identity, Our story, Contact, Development team; logo upload; developers add/remove) ↔ **Preview mode** ("Preview page"/"Back to editing" toggle replaces the form with the page preview, heading "Page preview · Published/Unpublished"; section nav hidden). Published switch; Save; toasts; realtime. |
| **Settings** | `/settings` | `settings/*`, `use-barangay-settings.ts` | Nav | [fixed] Loading skeleton + "Loading settings…"; no-barangay notice; load error + Retry; sections Contact / Operating hours / Features (4 switches) / Audit notifications (master switch; **9 category checkboxes**: service requests, announcements, incidents, residents, waste management, health, evacuation centers, staff, system; Authentication events: log admin logins/logouts; the category fieldset is disabled when the master switch is off); form-level + server error alerts; **Cancel = `router.back()`**; "Save Settings"/"Saving..."; toasts "Review the highlighted fields…", validation message, "Settings saved.", "Failed to save settings: …", unconfirmed warning. |
| **Archives** | `/archive`, `/archive/[screen]` | `archive/*` | Nav; "Browse archived records" link on 13 section pages | Index redirects to Services; 13-tab strip with per-tab spinner; record-table archives (Restore, Delete, sheet with "Archived record" banner; empty "No archived records found."); content archives (Record/Description/Archived on/Details, detail dialog; waste filter Zones/Schedules/Dumping reports); unknown `[screen]` → default 404 in shell [fixed]; loading skeleton; error row. |
| **Search results** | `/search` | `search/*`, `components/admin/search/*` | Header → See all | Prompt / loading / grouped results / paginated category / no results / unavailable (Try again, Retry, Sign in); 15 category chips. |
| **Search record detail** | `/search/[category]/[recordId]` | `search/[category]/[recordId]/page.tsx` | Click result | Back link, header, field grid (PHP/dates/weekday/underscore formatting), workspace link; requests redirect to the request sheet; not-found/error per §1. |

---

## 9. Overlay master list [added]
Every place the code renders a dialog, drawer, sheet, popover or confirmation (swept via `<dialog`, `createPortal`, `TableDetailDialog`, `ContentSideSheet`, `ContentEditDialog`, `DropdownSurface`, `ProfileDialog`, `role="dialog|menu|listbox"`).

| Overlay | Kind | Opened from | Source |
|---|---|---|---|
| Record side sheet (details/edit) | right sheet | row eye/edit, `?record=` | `record-workspace.tsx` |
| Archive/Restore/Delete confirmation | modal `<dialog>` | row icons, sheet buttons | `record-workspace.tsx` |
| Content create sheets (service, announcement, zone, schedule, hub, center, FAQ) | right sheet | page header buttons | `content-create-panel.tsx` |
| Content edit dialogs (7 kinds) | modal | row Edit | `content-edit-dialog.tsx` |
| Archived content details | modal | archive row/eye | `archive/[screen]/content-records.tsx` |
| Resident ID review | modal | ID Status chip | `resident-id-review.tsx` |
| Family attendance (+ camera) | modal | "Scan Family QR / Attendance" | `attendance-dialog.tsx` |
| Clear routing entrance | modal | Centers & entrances | `routing-conditions-editor.tsx` |
| Profile: change email / change password / edit picture / unlink / discard-guard | modal (`ProfileDialog`) | Profile workspace, nav while dirty | `profile-security.tsx`, `profile-workspace.tsx`, `profile-navigation-guard.tsx` |
| Emergency QR instruction editor | modal | Instructions → Edit | `qr-instructions-modal.tsx` |
| Notifications popover / drawer / detail panel | popover, drawer, drawer | bell | `header.tsx`, `notifications-drawer.tsx`, `notification-detail-panel.tsx` |
| Date-range picker | popover (`role=dialog`) | drawer filters | `date-range-picker.tsx` |
| Account menu | menu | avatar | `admin-action-menu.tsx` |
| Row context menu | menu | right-click row | `row-context-menu.tsx` |
| AdminSelect list / suggestions / search listboxes | listbox | selects, Transactions reference, navbar search, map search | `dropdown/*`, `navbar-search.tsx`, `MapSearchBar.tsx` |
| Map popups | Leaflet popup | marker click | `MapMarkerPopup.tsx` |
| Inline confirms (ConfirmButton, cancel-reason form, remove-incident confirm) | inline | many | see §3 |
| ~~Incident / Drive / Applicant detail modals, member form modal~~ | [removed] | unreachable | §3 |

No approve/reject dialogs exist: the only approve/reject-like decision is **resident ID Verified / Verification Failed**, which is the ID review dialog above; request "assign" does not exist.

---

## 10. Record status workflows [fixed — complete]

| Record | Statuses | UI effects |
|---|---|---|
| Service request | `submitted` → `in_progress` → `ready_for_pickup` → `completed`; `cancelled`. Payment `pending/paid/failed/refunded/waived` (+method `pickup/qrph`). v2: `sla_state` (`pre_processing/running/paused/ready`), `fee_assessment_state` (`pickup_due/assessed`) | Pills; workflow buttons (§5); Actions column width; Status select restricted on v2; cancel reason required (inline form, and v2 sheet field). |
| Payment | `pending/paid/failed/expired/cancelled(edit only)/refunded`; refund `none/pending/processing/refunding/failed/refunded` | Tabs (no Cancelled tab), pills, refund control, edit form hides amount after pending. |
| Resident ID | `null`, `pending`, `verified`, `verification_failed`, `id_repair_required` | Chip colour/label; review form options; tabs. Email: verified/unverified. |
| Incident | `open → in_progress → resolved`; `withdrawn`, `unresolved` terminal | Buttons, tabs, map popup, dumping rows (open/in_progress only get action buttons). |
| Medical drive | `is_active`; time-derived upcoming/today/past | Tabs; Active/Inactive pill; edit toggle. |
| Registration | `pending/confirmed/attended/cancelled` | Tabs; Cancel Registration hidden for cancelled/attended. |
| Household person | checked in / no active stay (+ per-stay outcomes) | Tabs, centre column, attendance receipt. |
| Catalog content | active/inactive/archived (+verified, at-capacity for centres) | Tags, chips, archive pages. |
| FAQ | draft / published / archived | Pills; Restore/Delete-forever on archived. |
| Staff | admin vs staff (account type), `is_active`, official role | Tabs; self-protection. |
| Notification | read/unread | Dot, bold, badge. |
| Routing | closure active/reopened; entrance set/not set; editable/preview | §7. |
| Site content | `is_active`/published (Terms, Privacy, About Us) | Switch; preview wording. |

---

## 11. Resident portal inside admin-web (secondary) [added detail]

| Screen | Route | Source | States |
|---|---|---|---|
| Home | `/resident` | `resident/page.tsx` | 3 action cards, recent requests/reports, empty texts |
| Profile | `/resident/profile` | `resident/profile/*` | Form, toasts, ID verification status, **Upload Valid ID** (type select, "Specify ID type", front/back, size/type errors, submitted notice) |
| Requests list | `/resident/requests` | `resident/requests/page.tsx` | Rows with status, SLA status (`agency_minutes_v1`) or flag, "Previous timing model" tag, empty "Request your first document" |
| New request | `/resident/requests/new` | `new-request-form.tsx` | Document select |
| Request detail | `/resident/requests/[requestId]` | `[requestId]/page.tsx`, `cancel-request-button.tsx`, `pickup-choice.tsx` | Submitted, Notes, Purpose, Status Timeline (+empty), SLA status, pickup-payment choice message, cancel ConfirmButton; unknown id → default 404 |
| Reports list / New report | `/resident/reports[/new]` | `resident/reports/*` | Empty "Report your first incident"; form with geolocation errors, category empty, zone select |
| Shell | all | `resident-shell.tsx` | Nav Home/My Requests/My Reports/Profile, Log out |

---

## 12. Toast and message catalog (by origin) [fixed]
Auth/shell: Welcome back; Login failed; Logged out; logout warning. Reset flow: 6 messages. Table cells: "Changes saved.", "Update failed: …", "Enter a valid {col}.", "Enter a valid date and time." Record sheet: Changes saved / archived / restored / permanently deleted; edit-option load failure. Create forms: "{Thing} created/published/added." + "Failed to …" + shared warning "The action could not be confirmed. Refresh the record before trying again." (some use "The change could not be confirmed. Refresh before trying again."). Settings: see §8. Notifications: mark-read errors/warnings, "All notifications marked as read.", "Matching notifications marked as read.", "Copied to clipboard." Map: full-screen failures. Search: "Could not refresh search results…". Profile/proof: ownership verified, cleanup warnings, theme toasts. Row actions: "The action could not be completed. Check your connection and retry."

---

# AUDIT SUMMARY

## 13.1 Counts
Counting unit: **named inventory rows**, meaning the bold-first-cell rows in the original's section tables (77, from `grep -c '^| \*\*'`). Tags sit inside cells, so a grep of the tags is noisy. These counts were made by hand against the lists below and are accurate to about ±2.

| Result | Count | Which |
|---|---|---|
| Matched (kept as-is) | **53** of 77 | Original rows with no correction needed |
| Fixed | **24** of 77 | Resident record sheet; Incident record sheet (was "Incident detail modal / record sheet"); Health drives detail; Medical applicants detail; Refund control; Emergency QR (tab semantics); Terms & Privacy (tab semantics); About Us (preview is a mode, not a panel); Settings (9 categories, Cancel = back, extra toasts); Archives (404 behaviour); Staff (self-protection, labels); Services (no role check); Dashboard (link targets); Profile (dialogs, extra gates); Incident map (ignored query params); Family attendance (error set); Notifications drawer (toast set); Notification detail panel (label format); Table browse panel (no distinct no-results state); Record side sheet (edit forms); Archive confirmation (standalone path); Status pills (cancelled, other badge systems); Request record review (reach URL `/requests?record=<id>`); Global 404 (default 404 renders inside the shell for `/archive/<bad>`) |
| Removed (stale) | **1 row / 9 artifacts** | Dead code the first inventory described as live overlays: `IncidentDetailModal`, `DriveDetailModal`, `ApplicantDetailModal`, `MemberFormModal` (no importers), plus the unreferenced `use-households.ts`, `data-table.tsx`, `static-placeholder.tsx`, `table-browse-layout.ts`, and the unused `map` skeleton variant. Their strings are struck from the fixed rows. |
| Added (new rows) | **≈44** | §0.1 access gate table (9); tooltips and keyboard (2); route-level loading matrix (1); §3.1 per-table record edit forms and validation (9); §9 overlay master list (17); §11 resident portal split into 7 rows (net +6) |
| Added (new facts inside existing rows) | many | Realtime on 9 surfaces, toast catalog entries, ConfirmButton site list, per-table empty labels, 9+ breakpoint modules, API and search status codes |

## 13.2 Role-by-screen matrix (what the code enforces)

Legend: ✔ reachable, ✖ blocked (destination in parentheses), ◐ reachable with restrictions.

| Screen / action | Signed out | Resident | Admin (active) | Admin soft-deleted | Admin, roster inactive/other barangay | Admin, MFA pending | Admin viewing **own** staff row |
|---|---|---|---|---|---|---|---|
| `/login`, `/forgot-password`, `/reset-password` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| `/resident/**` | ✖ (/login) | ✔ | ✖ (/dashboard) | ✖ | ✖ | ✖ | — |
| `/dashboard` and all `(admin)` routes except Profile | ✖ (/login) | ✖ (/login) | ✔ | ✖ (/login) | ✔ (layout only checks profile role) | ✔ (no MFA check in layout) | ✔ |
| `/profile` | ✖ | ✖ | ✔ | ✖ | ✖ (/login) | ◐ MFA challenge screen | ✔ |
| `/profile-proof` | ✔ (gated by flag/params) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Table actions (create/edit/archive/delete) | — | — | ✔ (server action re-checks admin + `deleted_at`; RLS may still deny → error banner) | ✖ | ✔ | ✔ | ◐ Edit/Archive/Delete disabled; inline cell edit disabled |
| Request workflow buttons, ID review, refunds, incident transitions, settings/content edits | — | — | ✔ (RLS-dependent) | ✖ | ✔ | ✔ | ✔ |
| `/api/admin/*` invites | 401 | 403 | ✔ | 403 | ✔ | ✔ | ✔ |
| `/api/search`, search record page | 401 → "Sign in" | 403 | ✔ | 403 | ✔ | ✔ | ✔ |
| Archive screens | ✖ | ✖ | ✔ (needs `barangay_id`) | ✖ | ✔ | ✔ | ◐ Restore/Delete disabled for own staff row |

Official roles (captain, kagawad, secretary, treasurer, health worker, tanod, clerk, SK chairman, admin, staff) are **display only**: no screen, button or menu varies by them.

## 13.3 Searches and directories swept
- Directories: `src/app/**`, `src/components/**`, `src/hooks`, `src/lib`, `src/actions`, `src/proxy.ts`, `tests/` (names only), `next.config.ts`, `vercel.json`.
- File patterns: `page|layout|loading|error|global-error|not-found|template|default|route|middleware|proxy|forbidden|unauthorized` and `@*`, `(.)*`, `(..)*` directories (none exist: no parallel or intercepted routes).
- Content patterns: `redirect(|notFound()|forbidden()|unauthorized()`; `role !== 'admin'|activeAdmin|authorizeSearch|user!`; `<dialog|createPortal|TableDetailDialog|ContentSideSheet|ContentEditDialog|DropdownSurface|ProfileDialog|role="(dialog|menu|listbox|tab)"|aria-modal`; `(toast|notify).(success|error|warning|info)(` counted per file (≈66 files); `setError|setMessage|throw new Error` strings; `emptyLabel=`; `actions={` page-action buttons; `<ConfirmButton|<IncidentActions|<RequestStatusActions|<PaymentRefundAction|<AgencySlaStatus|<ScrollableChipRow|<DateRangePicker|<AdminSuggestions`; importer counts for every modal/helper component (found 4 dead modals, 3 dead helpers, 1 dead hook, 1 unused skeleton variant); `.channel(`; `@media` in all `*.css`; Tailwind `sm|md|lg|xl:` file counts; `@media print|forced-colors`; `PageSkeleton variant=`; `TABLE_CONFIGS` evaluated with node for sorts/filters/tab values; `record-config.ts`, `browse-state.ts`, `audit-notifications.ts` read in full.

## 13.4 Could not verify from code alone
- **RLS and DB views/RPCs**: whether a given admin is denied (`admin_*_browse/_records` views, `admin_profile_access`, `update_incident_status`, `resident_prove_admin_association`, routing and attendance RPCs). Denials surface as banners/toasts, but exact triggering data needs a second admin or a seeded policy test.
- **Pages that assume a profile row** (`user!.id` or `.single()` with no failure UI: waste-management, incident-map, emergency-qr, evacuation-centers, hub, faq, announcements, about-us, terms-privacy, settings, theme): if the profile lookup fails they probably hit Next's default error page, which has no custom UI here; not reproducible without breaking the DB.
- **Layout-only gating** for MFA-pending admins on non-Profile routes: the code does not check `aal2` there; whether the DB/RLS blocks data was not verified.
- **Backend-dependent states**: contract v2 SLA states, fee assessment, refund transitions (PayMongo), routing graph/pack versions, map boundary presence, trash-category presence, realtime events, camera permission, geolocation, storage signed-URL failures, and the 15 s abort timeouts.
- **Shared-package values** not enumerated: accent presets, `FONT_OPTIONS`, `ID_TYPES`, drive types' labels, waste types, announcement categories, hub icon names, `OFFICIAL_ROLE_LABELS`, zod messages for content forms.
- **Pixel/behavioural facts** (actual breakpoint appearance, dark-mode contrast, animation timing, Leaflet cluster behaviour) were not rendered; they are inferred from CSS and markup.
- Large files (`routing-conditions-editor.tsx` 985 lines, `editable-data-table.tsx`, `transactions-table.tsx`) were read by structure and strings, not line by line; the `*.module.css` per-screen styles were scanned only for media queries.
- `tests/` fixtures were not used as evidence of shipped UI.
