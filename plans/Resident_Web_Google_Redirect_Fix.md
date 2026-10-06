# Resident web Google authentication redirect

## Confirmed cause — 2026-10-06

The deployed Google button passes the current browser origin to Supabase:
`https://barangayan-resident-web.vercel.app/auth/callback?next=%2Fhome`.
Both registration and login use this button. The hosted Supabase project rejects
the production redirect and falls back to `http://localhost:3000`.

Live checks started Google OAuth and cancelled it before consent. Both the
production callback with `next` and the callback without a query returned to
localhost. The localhost callback was accepted. A separate request to the deployed
web callback without a code correctly redirected to the production `/auth/error`.
This locates the problem in hosted Supabase URL configuration, before the web
callback is reached.

## Required hosted change

Open https://supabase.com/dashboard/project/pwjbucnyqexiepoinoke/auth/url-configuration.

Set **Site URL** to `https://barangayan-resident-web.vercel.app`.

Add these entries to **Redirect URLs**, preserving all existing entries:

- `https://barangayan-resident-web.vercel.app/auth/callback`
- `https://barangayan-resident-web.vercel.app/auth/callback?next=**`
- `http://localhost:3000/auth/callback`
- `http://localhost:3000/auth/callback?next=**`

The query pattern preserves the safe destination passed by the Google button.
Localhost needs explicit entries after it stops being the Site URL. Keep native
callbacks such as `barangayan://auth/callback` and any existing iOS entries.
Avoid replacing the allowlist or adding a wildcard for every Vercel project.

Google's authorized redirect URI remains
`https://pwjbucnyqexiepoinoke.supabase.co/auth/v1/callback`, which the live provider
authorization response already uses. The resident app does not read a Site URL
environment variable; its OAuth destination comes from `window.location.origin`.
This fix requires no application changes, Vercel environment changes, redeploy,
database migration, or Android UI changes. The local `supabase/config.toml` governs
the local stack and does not repair hosted settings.

## Verification

Run `node scripts/resident-web-oauth-redirect-check.cjs` from the repository root
after saving. It uses cancelled PKCE OAuth flows without Google consent, user
creation, or session exchange. It checks production sign-up and sign-in callback
destinations, localhost, an unlisted-domain fallback,
and the deployed web callback error redirect.

Then complete these browser checks using authorized Google accounts:

1. Existing resident: select **Sign in with Google**, complete consent, confirm
   return to the production domain and access to a protected resident page.
2. New resident: select **Sign up with Google**, complete consent, confirm return
   to the production domain and expected profile completion behavior.
3. Refresh the protected page to confirm the session persists.
4. Repeat sign-in from localhost and confirm it returns to localhost.

The initial hosted check passed localhost and the Vercel callback error redirect.
Both production OAuth cases, the query-free production callback, and the fallback
check failed because Supabase selected localhost. A separate native callback probe
also fell back to localhost before any changes; it is not a regression from this
work. No native authentication settings or application files were changed.

Google consent and valid authenticated sessions have not been verified in this
chat. Hosted configuration is pending a dashboard update: the connected Supabase
tools do not expose Auth URL configuration and browser control was unavailable.
Vercel project inspection also returned a team-scope authorization error.

Reference: https://supabase.com/docs/guides/auth/redirect-urls.
