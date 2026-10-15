# Initial design-state inventory (P00-T07) — Approved 2026-10-13

Approved by the named owner `KingJaqar` (decision-register OD-02) as the starting inventory; owning phases extend it per route/modal variant.

Source: handoff Rev 2.1 §11 (D01–D21 mandatory states), §6 component contract and plan B.3. This is the starting inventory each owning phase must complete per route/modal variant (handoff "Global state and modal design inventory"). No state is designed or verified yet.

Legend: **R** required; **—** not applicable, with the reason in the notes column. Columns: Def default · Load loading/skeleton · Empty true empty · Filt filtered/no-results · Err error with recovery · Off offline/stale/freshness · Gone unavailable/deleted/foreign · Auth guest or unauthorized · Part partial result/save · Unk unknown commit outcome · Perm OS permission denied/limited.

| Family | Routes / modals (ledger IDs) | Def | Load | Empty | Filt | Err | Off | Gone | Auth | Part | Unk | Perm | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| D01 Foundation | R01 R02 R54, all layouts; M16 | R | R | R | R | R | R | R | R | — | R | R | Part is feature-owned; primitives must support it. Includes session restoration retry/clear, late-account response, More overflow. |
| D02 Intro and guest | R41 R42 R46 R49 R50 | R | — | — | — | R | — | — | R | — | — | — | Static content; Load/Empty n/a. Personalization writes are local for guests (D18 owns persistence errors). |
| D03 Auth and setup | R40 R43–R45 R47 R48 R51–R53, IR04; M01 M12 | R | R | — | — | R | R | — | R | R | R | — | Part = optional provider setup step committed but next step pending. No OS permission involved. |
| D04 Home | R11 | R | R | R | R | R | R | — | R | R | — | — | Filt applies only if a defined Home search ships (A52-001). Part = one summary source fails while others load. |
| D05 Catalogue/charter | R22 R23 | R | R | R | R | R | R | R | R | — | — | — | Read-only; no commit. |
| D06 Application/review | R28, IR05 IR06; M02 | R | R | — | — | R | R | R | R | R | R | R | Perm = Photos/Files access for evidence. Part = some uploads complete. |
| D07 Requests/clocks | R29, IR10; Services Requests/Logs segments | R | R | R | R | R | R | R | R | — | — | — | Off shows server-evaluated time freshness. |
| D08 Assessment/payments | R24–R27; M03 | R | R | — | — | R | R | R | R | — | R | R | Perm = Photos add-only for QR save. Unk = cancel/settlement race. |
| D09 Maps/discovery | R13 R15; M04 | R | R | R | R | R | R | — | R | — | — | R | Gone handled per selected record in D11/D15. |
| D10 Emergency hub | R07 R08 R14 R16; M07 | R | R | R | R | R | R | R | — | — | — | — | Public content; Auth n/a except private sections owned by D12/D13. |
| D11 Centers/location/routes | R08 (centers), R15; M04 | R | R | R | R | R | R | R | — | — | — | R | Includes six-action location card states (slow, timeout, reduced, stale). |
| D12 Center QR/check-in | R09 R10 R12; M05 | R | R | — | — | R | R | R | R | — | R | R | Off = not-confirmed state; never success. |
| D13 Family/household QR | R08 (family), R38; M06 | R | R | R | — | R | R | R | R | R | R | — | Filt n/a (no search in source). Part = save conflict/reload. |
| D14 Medical drives | R03–R05, IR08; M08 | R | R | R | R | R | R | R | R | — | R | — | No OS permission involved. |
| D15 Reports/concerns/reads | R17–R20, IR01; M09 M10 | R | R | R | R | R | R | R | R | R | R | R | Part = optimistic read rollback; Perm = location/photos for concerns. |
| D16 Profile/ID evidence | R38; M11 | R | R | — | — | R | R | — | R | R | R | R | Partial save is mandatory wording (plan §6.6). |
| D17 Email/location/password | R32 R33 R37; M12 | R | R | — | — | R | R | — | R | — | R | R | Perm = location for verification. |
| D18 Appearance | R36 (appearance), R46; M13 | R | — | — | — | R | — | — | R | — | — | — | Err = persistence rollback/unsaved; guests session-only. |
| D19 Inbox/push/preferences | IR02 IR03, R36 (notifications) | R | R | R | R | R | R | R | R | — | R | R | Perm = notification permission not-determined/denied/provisional. |
| D20 Export/delete/logout | R36, IR07; M14 | R | R | — | — | R | R | — | R | R | R | — | Part = export section failure (never "complete"). |
| D21 Help/legal/About | R31 R34 R35 R39, IR09; M15 | R | R | R | R | R | R | R | — | — | — | — | Public content. |

Every family additionally requires: light/dark/custom-accent variants, all ten font IDs, largest Dynamic Type, VoiceOver order/labels, Reduce Motion/Transparency, compact and large iPhone layouts, keyboard and dirty-dismissal behavior (handoff §9, G22).

Route/modal IDs refer to `route-ledger.csv` (R/IR) and `modal-ledger.csv` (M). Note `IR` numbering: IR01 announcement detail, IR02 inbox, IR03 inbox entry, IR04 Apple continuation, IR05 application review, IR06 submitted receipt, IR07 export result, IR08 drive detail, IR09 resident information, IR10 Services Requests segment.
