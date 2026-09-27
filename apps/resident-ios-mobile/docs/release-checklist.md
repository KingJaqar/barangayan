# Resident iOS release checklist

This checklist supplements the execution-ledger section in `plans/Resident_iOS_Implementation_Plan.md`. A checked source item does not replace staging, device, signing, or TestFlight evidence.

- [ ] Confirm the release tenant, Supabase URL/anon key, bundle ID, URL scheme, and EAS project with their owners. Keep secrets out of source control.
- [ ] Apply migrations 0093 and 0094 in staging and run all Supabase tests, including two-tenant household, ID storage, medical registration, and evacuation check-in cases.
- [ ] Keep QR Ph disabled until settlement, paid-request reopening, concurrent creation, lost response, partial failure, expiry, cancellation, polling, webhook, duplicate, and replay checks pass.
- [ ] Approve map/geocoding/routing providers, emergency content, moderation, retention, account deletion, data-export inventory, notifications, and the household QR processor disclosure.
- [ ] Run a clean lockfile-preserving root install with supported Node, then shared/iOS typecheck, lint, tests, and production export.
- [ ] Test compact, standard, and large iPhones on iOS 16.4 and a currently supported release, including light/dark mode, Dynamic Type, VoiceOver, reduced motion, keyboard, denial, cancellation, retry, and offline recovery.
- [ ] On physical devices verify Keychain restart/logout/account switching, camera/QR, Photos/Files, location, save/share, background/resume, notifications, and iOS Settings permission changes.
- [ ] Supply an opaque 1024×1024 approved iOS icon. The preserved logo has transparency and is currently used only for the splash screen.
- [ ] Create a signed production build with approved credentials and verify privacy manifests, usage descriptions, entitlements, environment, branding, and deep links.
- [ ] Validate the exact release candidate in TestFlight with required internal/external testers and record build number, devices, OS versions, outcomes, and approvers in the implementation plan's execution-ledger section.
- [ ] Run `npm run check:release --workspace=@barangayan/resident-ios`; a zero exit only confirms configuration and source gates, then obtain final product/privacy/backend/release approval.
