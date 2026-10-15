# Android behavior captures (P00-T06) — reviewed 2026-10-14

Source: [contexts/Barangayan Resident Android — Screens.pdf](../../../../../contexts/Barangayan%20Resident%20Android%20—%20Screens.pdf), exported by the owner from Figma (page "Full capture — states, scrolls, dark"). 195 pages, 360×640 pt, image-only. SHA-256 `0CFCCA99…788F8B5CF`. The PDF is not duplicated here; `captures.json` maps every page (1–195, each exactly once) to its route, modal, theme and state.

The captures use the sanitized test resident "Phase Tester". Page 153 shows an approved-ID preview that looks like a specimen/test image. Do not add real resident data to future captures.

## Coverage

44 of the 54 R-entries are screens (10 are layouts). 32 screens are captured in light mode and 12 have at least one dark-mode capture.

| Status | Routes |
|---|---|
| Captured | R04, R05 (loading state only), R08 (all five tabs), R11, R14, R15, R16, R19, R20, R22, R23, R24, R25, R28, R29, R31, R32, R33, R35, R36, R37, R38, R39, R41, R42, R43, R44, R46, R47, R48, R49, R50 |
| Non-visual (nothing to capture) | R12 (obsolete alias), R52 (auth callback), R54 (root redirect) |
| **Not captured** | R09 standalone QR guide, R10 camera scanner, R18 incident detail, R26 QR PH payment, R27 payment success, R34 help article, R45 registration OTP, R51 account setup, R53 complete profile; R05 populated registration form |

Modal families captured: M02 purpose sheet, M06 household QR, M08 month/year picker, M09 location pin picker, plus the incident validation dialog and map marker dialog. Not captured: birthday picker, ID type selector, custom accent color picker, export chooser/share, delete-account and logout confirmations, photo viewer, camera permission, center QR show/share/save.

The missing screens need no test data that blocks Phase 1–18. They must be captured before the P19-T05 visual comparison. That is now an owned follow-up, not a Phase 0 blocker.

## Observations (source-checked where noted)

| # | Observation | Pages | Effect on iOS |
|---|---|---|---|
| O1 | **Offline evacuation routing is now visible in Android**: "Road closures checked just now · Offline map (2026-10-12) · © OpenStreetMap contributors". Source: new uncommitted `components/offline-route-card.tsx` and `hooks/use-offline-routing.ts` (DRRM routing plan R6). | 34–36, 45–47 | Contradicts the 2026-10-13 A52-012 "not wired" state for the working tree. Scope decision needed; see "Baseline drift". |
| O2 | Facility chips print the icon **name** as text ("medkit-outline Medical", "paw-outline Pet Friendly"). Source: `components/evacuation-center-card.tsx:113` renders `facility.icon` inside `ThemedText`. | 35–36, 37, 39 | Android defect. iOS renders the icon (SF Symbol or equivalent) plus the label; do not copy. |
| O3 | Center distance "13763.9 km · Est. 191165 min" from an emulator location far outside the barangay, with no out-of-area warning. | 34–39, 45–47 | iOS must flag implausible/out-of-area origins (D11, P14-T01/T05). |
| O4 | Household QR image is blank in the Family card and in the Show My Code modal. | 41–42, 52, 61 | Root cause not verified. P15-T05 must prove actual QR output. |
| O5 | Recovery code step reads "Enter the six-digit code sent to ." (email missing); the login email field shows `you%40test.com` (URL-encoded). | 160–164 | Route-parameter decoding/handoff defects. iOS validates/decodes link parameters (P04-T01/T05). |
| O6 | DRRM hub tile wraps mid-word ("Preparedn ess Guide") and the "Offline" chip is clipped. | 53, 57, 134, 181 | Android layout defect; handoff content rules apply. |
| O7 | Dark mode: emergency category label and read/unread icons on announcement cards, and required-field asterisks, have very low contrast. | 135, 139 | Android contrast defect; G22 contrast checks apply on iOS. |
| O8 | Content: About Us repeats "Barangay Barangay Ampid I"; a Help article points to a "Transactions tab" the resident app does not have. | 108, 113–117 | Content-owner fixes (PR-17), not app code. |
| O9 | Applicant Registration shows only a spinner. | 185 | Entry state unknown (likely opened without a drive). Recapture with a real drive. |
| O10 | Location Verification shows "Locating you…" in five captures within one minute. | 102–106, 192 | Too short to judge the 10 s slow / 45 s timeout states. |
| O11 | Placeholders confirmed: "Hotline directory content goes here." / "Preparedness guide content goes here." | 182–183 | Confirms A52-006/007. |
| O12 | One Reports badge (8) with no active or unread-resolved reports. | all | Consistent with A01-032 (zero counts hidden). |
| O13 | "Pay with QR PH" is offered and pickup payment is recorded; a foreground "Request Update" banner appears. | 148–150 | QR PH flag is on in this build (A52-005); foreground local notifications work (A44). Not iOS settlement evidence. |
| O14 | Theme choices are Light and Dark only (no System), in Settings and onboarding. | 89, 142–144, 165–166 | Matches A43-001/002. The iOS System option is the approved iOS addition (plan §6.6), not Android parity. |
| O15 | Page 38 is two screenshots overlapped. | 38 | Capture artifact; ignore. |

## Baseline drift found during review

Since the Phase 0 baseline (HEAD `2e5681c`, 2026-10-13), concurrent uncommitted work changed the Android app: 15 modified files and new screens `src/app/(app)/settings/valid-id.tsx` (ID wizard: front photo only, "a back photo is not required") and `src/app/emergency-centers.tsx` (public, outside every auth guard: Centers map and offline routes). Also new: offline routing modules, birthday wheel, `extract-resident-id` and `evacuation-route` Edge Functions, migrations `0115`–`0118`, and the OSRM helper was deleted. The ledger verifier now reports these two route files as unlisted. They are recorded as untriaged delta rows `RD01`/`RD02` (see `../README.md`), not as approved scope.
