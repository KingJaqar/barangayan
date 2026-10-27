# Complete Profile loading-error diagnosis and fix

25 October 2026, Asia/Manila. **Fixed in the working copy.** The observed message was a misclassified account restriction, not a missing profile or locality. No database/account/permission change, dependency, migration, commit, push, deployment or remote data mutation was made.

## Confirmed cause

The active native session belongs to a non-deleted **admin** profile. The exact profile, registration-locality and barangay-boundary reads all returned **HTTP200 with data**, and the profile's barangay matched the configured locality. A caught-exception trace of the real Retry action identified `Error: This account cannot complete resident setup.` The form intentionally rejects non-residents/deleted accounts, but its catch-all replaced that rejection with “Unable to load your current profile or registration locality. Check your connection and retry.”

Therefore the earlier explanation of a profile/locality loading failure was inaccurate: loading succeeded; the following resident-only guard rejected this admin account. The account restriction is consistent with the existing database completion functions and the application's intentional staff/admin existing-access route. It must remain enforced.

After the fix, the native form shows the existing safe account message (“This account cannot continue resident setup. Sign out and use the correct account.”), Back to Home and Sign out. It has **zero editable inputs, no save action and no futile Retry**. Back to Home works and leaves the session unchanged. The ordinary Settings/Profile access policy remains unchanged.

Sanitized evidence: native-query-baseline.json, load-exceptions.json and native-verification.json. Raw native screenshots stay in ignored local temporary evidence, outside Repomix packets. No access token, user identifier, email or profile values were exported into the context packet.

## Related fixes

| Owner | Verified problem / resulting behavior |
|---|---|
| Mobile ResidentDetailsForm | Validate the freshly read profile first. Preserve resident/deleted-account checks and additionally reject a mismatched profile owner. Account/session errors retain their typed, safe messages. Locality/boundary errors remain distinct from profile transport errors. |
| Loading/retry presentation | Show a loading indicator while reads are pending; hide Retry while loading. Retry is offered only for recoverable failures. Missing sessions terminate with sign-in guidance, rather than leaving an uninitialized form. Submit is absent until initialization succeeds and its handler also rejects blocked/loading/conflicted states. |
| Existing-resident locality | The old helper always selected whichever locality enabled new registrations. The database completion contract instead uses an existing profile's own barangay. Mobile now passes that freshly read barangay ID, so readonly locality/map data stay with the resident's existing tenant, including when that locality no longer accepts new registrations. New profiles still require exactly one enabled signup locality; there is no first-row fallback. The differing-localities case is covered by controlled tests, not manufactured remote data. |
| Locality helper cancellation | Both locality and boundary reads share the caller's AbortSignal. Cancelled/unmounted/obsolete loads cannot begin another boundary read or replace a newer draft. Standalone callers retain the existing10-second deadline; timers are cleared. Null advisory polygons remain allowed; missing/ambiguous configuration and missing barangay rows fail closed. |
| Shared setup-status errors | HTTP401 is classified as session expiration. The setup-status RPC now forwards its response status, which was previously lost because PostgREST's error object need not carry an HTTP status. A rejected/expired session is not treated as an unknown retryable setup problem. |

All existing profile snapshot/CAS, uncertain-write, busy, readonly locality/email, tenant, auth and RLS guards remain. Initial metadata is used only for name suggestions; no authorization decision uses user metadata. No profile, password, registration, role or locality was saved during verification.

## Verification

| Check | Actual result |
|---|---|
| Baseline | Mobile TypeScript/lint pass;59 existing shared auth/setup tests pass; live API reads and native account failure reproduced before edits |
| Shared unit suite, final | **586 tests /38 files pass**, including10 locality tests and session/status regressions |
| Mobile unit suite, final | **335 tests /32 files pass** |
| Form browser regression | **6 groups pass, zero captured errors/warnings**: eligible/own-locality, admin/deleted/missing-session,401, transient retry/loading, new-profile/config/boundary, stale account/unmount cancellation |
| Existing Settings/Profile browser regression | Pass; original suite unchanged |
| Mobile TypeScript6.0.3 and affected ESLint | Pass, no diagnostics |
| Resident-web installed TypeScript5.9.3 | Pass; shared API remains compatible; no resident-web source changed |
| Standalone shared TypeScript6.0.3 |6 pre-existing diagnostics: FileReader missing from its ES2020-only configuration and four incomplete service-catalog test casts. Snapshot-backed comparison shows **baseline6/current6/new0**. No unrelated type/config fix or suppression was added. |
| Android JS/Hermes export | Pass; existing color-environment warning remains; this is not a native APK build |
| Actual shared helper against live public API | Pass for default registration and explicit-barangay lookups, same expected barangay and existing boundary; readonly public client, no persisted session |
| Native account case | Pass: admin/non-deleted confirmed, correct restriction, no misleading connection message/Retry/editor/save, Back to Home succeeds, keyboard hidden, diagnostics removed |
| Native source identity |29/29 checked loaded application factories/source-map originals match final source after reload |
| Console | Browser assertions clean; native monitored before/after issue sets unchanged. Buffered pre-existing push-token warnings remain; no global warning-free claim. |

Full logs, source/packet identities, source-comparison diagnostics and test results accompany this report. The native app was reconnected from its development launcher to the existing Metro server using its registered dev-client scheme; no external service configuration changed. The inspector does not await the app's polyfilled promises, so the readonly diagnostic used a bounded temporary result object, removed afterwards. The caught-exception debugger setting was restored.

## Scope and remaining verification

The native account restriction is verified in the actual admin session. Valid-resident initialization and failure/edge behavior are covered by the real form with explicit browser network/native adapters and by the actual shared helper's live readonly API calls. **A native resident-account completion/save was not performed.** Use a designated resident development account for that final end-to-end case; no production account role should be changed to make this test pass.

Earlier keyboard Phase2 acceptance remains separate and partially complete. The old “profile/locality load gap” was an unresolved symptom; the follow-up plan note now records the confirmed admin-account cause. Other keyboard routes/devices, including lower setup fields, are not promoted to passed by this work.

Database configuration, access grants, RLS metadata, log sources and existing security/performance advisories were reviewed read-only. No database repair was indicated by this all-200/client-guard failure. Existing unrelated advisory summaries and their remediation links are retained in database-review.json; this was not a broader database-security cleanup.

References checked: [Expo57](https://docs.expo.dev/versions/v57.0.0/), [DevClient57](https://docs.expo.dev/versions/v57.0.0/sdk/dev-client/), [RN0.86 ActivityIndicator](https://reactnative.dev/docs/0.86/activityindicator), [React19.2](https://react.dev/blog/2025/10/01/react-19-2), Supabase [abortSignal](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal), [maybeSingle](https://supabase.com/docs/reference/javascript/maybesingle), [column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security). Installed Supabase/PostgREST2.112.1 implementations were also inspected; no new SDK feature/dependency was introduced.
