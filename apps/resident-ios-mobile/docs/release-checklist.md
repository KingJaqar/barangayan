# Resident iOS release checklist

This checklist supplements the execution-ledger section in `plans/Resident_iOS_Implementation_Plan.md` and the Phase 20 records in `plans/evidence/resident-ios-parity/phase-20/`. A checked source item does not replace staging, device, signing, or TestFlight evidence. Owner decision OD-06 (2026-10-14) skips every signed-build item below; the first unchecked signed-build item reopens everything it blocks if OD-06 is ever revoked.

## Source candidate (no signed build needed)

- [ ] From the iOS workspace run `npm run typecheck`, `npm run lint`, `npm test`, `npm run export:ios`; from the repository root run `node plans/evidence/resident-ios-parity/phase-19/audit.mjs`, `node plans/evidence/resident-ios-parity/phase-20/inspect-candidate.mjs` and `node plans/evidence/resident-ios-parity/phase-20/privacy-scan.mjs`. All exit 0 (the inspection lists open placeholder items; they are not failures).
- [ ] Refresh `phase-19/candidate.json` with `node plans/evidence/resident-ios-parity/phase-19/freeze.mjs` after any later source or contract change.
- [ ] Confirm the migration state of the hosted project against the repository (`0001`–`0136` in the repository; hosted was at `0134` on 2026-10-21) and the deployed Edge Function versions.
- [ ] Backend rollback rehearsed: `bash plans/evidence/resident-ios-parity/phase-20/rollback-rehearsal.sh` passes on a disposable clone.

## Owner-supplied facts (nothing here may be guessed)

- [ ] Apple Developer team, approved reverse-DNS App ID (`IOS_BUNDLE_IDENTIFIER`), Sign in with Apple and Push Notifications capabilities, provisioning (PR-02).
- [ ] URL scheme and OAuth callback allowlist, or the decision to keep Google browser sign-in unavailable (PR-03, skipped by OD-07).
- [ ] EAS project ID and build secrets (PR-04); production tenant ID and `EXPO_PUBLIC_ENVIRONMENT=production` (PR-18, skipped by OD-07).
- [ ] Supabase Apple provider and the Apple revocation key held server-side (PR-06).
- [ ] Publicly reachable privacy policy and support URLs, and a monitored support contact (PR-17).
- [ ] An opaque 1024×1024 approved App Store icon. The preserved logo (`assets/barangayan-logo-1024.png`) has an alpha channel and a transparent background, so it cannot be submitted as the icon.
- [ ] Export-compliance (encryption) answer and the age-rating questionnaire answers, given by the owner in App Store Connect.
- [ ] A reviewer account and a QR code that is safe to scan on the production backend, owned by a named person (PR-17; see `phase-20/P20-T03_*`).

## Gates and backend (all must be open or explicitly approved for the exact candidate)

- [ ] Deploy `0135`, `0136`, the `export-my-data`/`delete-my-account` v2 functions and `send-notifications` only on the owner's approval, then open `completeExport`, `accountDeletion` and `remotePush` with their evidence. Account deletion must be reachable in the app before store submission (App Review Guideline 5.1.1(v)).
- [ ] Decide `householdEditing`, `privateIdUploads`, `mapProviders` and `publicIncidents` (G03, G04, G07, G12); a closed required gate cannot be described as a complete conversion.
- [ ] Keep QR Ph settlement, webhook, duplicate and replay evidence (PR-08) and pickup collection evidence (PR-09) recorded against the production backend.
- [ ] Approve map/geocoding/routing providers, moderation, retention and the data-export inventory; record each approval with its owner.

## Signed build, devices and store (Skipped — OD-06 / Pending device — OD-14)

- [ ] Create a signed production build with approved credentials and verify the privacy manifest report (Xcode "Generate Privacy Report"), usage descriptions, entitlements (`aps-environment` becomes `production` in the archive), environment, branding and deep links.
- [ ] Test compact, standard and large iPhones on iOS 16.4 and a current release, including light/dark, Dynamic Type, VoiceOver, reduced motion, keyboard, denial, cancellation, retry and offline recovery.
- [ ] On physical devices verify Keychain restart/logout/account switching, camera/QR, Photos, location, save/share, background/resume, notifications and iOS Settings permission changes.
- [ ] Validate the exact release candidate in TestFlight and record build number, devices, OS versions, outcomes and approvers in the execution ledger. Use a staged rollout with the documented kill-switch and rollback response.
- [ ] Run `npm run check:release --workspace=@barangayan/resident-ios` with the production variables; a zero exit only confirms configuration and source gates, then obtain final product, privacy, backend and release approval.
