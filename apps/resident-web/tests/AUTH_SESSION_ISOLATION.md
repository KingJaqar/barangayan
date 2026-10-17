# Admin Web / Resident Web authentication isolation

## Verified cause

Both web environment files point to the same Supabase project. Before this fix,
all six browser/server/proxy factories used the SDK's default project storage
key, `sb-<project>-auth-token`. Cookies are shared across ports on a hostname.
Using the installed `@supabase/ssr` 0.12.4 / Auth 2.112.1 SDKs and synthetic
HTTP replies reproduced a resident server client reading an admin-written session.
Ordinary logout also sent `scope=global`, the SDK default, which revokes the
account's other sessions even if their browser storage is separate.

## Focused fix

- Each app supplies its own project-specific `cookieOptions.name` to its existing
  browser, server and proxy factories. The installed SSR SDK also uses that name
  as Auth's storage key, isolating cookie chunks, PKCE verifiers, locks and
  BroadcastChannel events while retaining synchronization between the app's tabs.
- Ordinary logout explicitly uses `local` scope. Existing account-deletion and
  password-change global security cleanup is retained.
- Resident logout failure detection checks only its own session cookie/chunks.
- Resident proxy forwards its refreshed request cookie header into the current
  render while preserving `x-pathname`. The previous copied header retained the
  expired cookie; a regression test detected this during verification.

No database, RLS, role guard, redirect destination or UI change is required.
Existing unrelated working-tree edits were preserved.

## Rollout

Deploy both web apps with this change. Existing users must sign in to each app
once: the previous shared cookie is intentionally ignored, without copying or
deleting it. Old open tabs should reload to load the new clients. In-progress
OAuth/recovery flows started before deployment should be restarted if their old
PKCE verifier is no longer recognized.

Session isolation does not make two accounts out of one identity. Account deletion,
password changes, explicit global revocation and backend session policies continue
to have their existing account-wide effects. Hosted Auth settings, including any
single-session policy, were not changed or verified by this local test run.

## Reproduce the checks

From the repository root:

```powershell
npm run test:tables --workspace=@barangayan/web
npm exec --workspace=@barangayan/resident-web -- vitest run --config vitest.config.ts
node apps/resident-web/tests/auth-session-browser.mjs
npm run typecheck --workspace=@barangayan/web
npm run typecheck --workspace=@barangayan/resident-web
npm run lint --workspace=@barangayan/web
npm run lint --workspace=@barangayan/resident-web
```

The browser script requires installed Chrome and access to loopback HTTP. It
bundles the actual browser client factories and resident logout helper, uses real
Chrome cookies/BroadcastChannel, and supplies synthetic Auth HTTP replies. It
writes a report to `tmp/auth-session-isolation/browser-results.json`.

The server isolation tests use the actual Supabase SDK and NextRequest/NextResponse
with synthetic Auth replies and a per-request cookie-store fixture. Guard tests
execute the existing layouts with controlled authentication/profile replies.

## Evidence and limits

Chrome 155.0.8059.80 passed the same-origin and different-port matrices, each with
four tabs: separate identities; the same identity in both apps; independent login
and logout; reload persistence; refresh after peer logout; failed login; PKCE
namespaces; scoped broadcasts; chunked cookies; and ignoring the legacy cookie.
The complete browser run made 30 Auth requests and 8 local logout requests, with
no unexpected browser errors.

The final focused authentication tests passed (13 resident SDK/logout tests and
7 admin guard/logout tests). The full admin suite passed 128 tests. The final
resident suite passed 125 of 126 tests, with an unrelated pricing-text expectation
mismatch in `tests/search.test.ts`; that test and its search/pricing sources are
unchanged by this work. Both app type checks, full lint checks and production
webpack builds passed. Build logs are in `tmp/auth-session-isolation/`.

These tests do not constitute hosted end-to-end acceptance: no real accounts were
used, no live database RLS checks ran, and no external OAuth provider or email
recovery flow completed. The local Docker/Supabase service was unavailable.

Official references:
- [Supabase signOut scopes](https://supabase.com/docs/reference/javascript/auth-signout)
- [Supabase SSR clients](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase session policies](https://supabase.com/docs/guides/auth/sessions)
