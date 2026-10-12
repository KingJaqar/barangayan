# RW-LT-00 local fixture instructions

Synthetic accounts and records for resident-web feedback verification. Local loopback stack only; never production data or provider configuration.

## Prerequisites

- Local Supabase stack running in Docker Desktop with the gateway on `127.0.0.1:54321` (`supabase_kong_barangayan`, `supabase_db_barangayan`). The entrypoint refuses any other API port and reads the local gateway keys in memory only.
- At RW-LT-00 the Docker Desktop stack had **no Realtime container** (WebSocket handshakes return 503) and the Edge runtime container was exited. Realtime-driven refresh and live Edge Function behavior are therefore not locally reproducible; provider outcomes are mocked in the browser instead.
- The older `barangayan-phase1` WSL stack used by earlier phase scripts was stale (containers had lost their Docker network). It was stopped with `supabase stop` (data volumes preserved) and is not used by this plan.

## Commands

```bash
node scripts/resident-web-feedback-regression.cjs rw-lt-00:fixtures seed
```

```bash
node scripts/resident-web-feedback-regression.cjs rw-lt-00:fixtures status
```

```bash
node scripts/resident-web-feedback-regression.cjs rw-lt-00:fixtures cleanup
```

- `seed` refuses to run if the fixtures already exist, generates fresh random passwords, and stores credentials **only** in gitignored `dist/rw-feedback-tools/fixtures.json`. [fixtures/seed.json](fixtures/seed.json) records IDs and before/after non-fixture counts without passwords.
- `cleanup` removes only rows in the fixture tenant and the four fixture Auth users, asserts all non-fixture counts are unchanged ([fixtures/cleanup.json](fixtures/cleanup.json)), and deletes the credentials file.
- A full cleanup → seed cycle was run on 2026-10-12 and passed. The fixtures are currently seeded for use by RW-LT-01 onward.

## Fixture set

All IDs use the prefix `5e0d0000-0000-4000-8000-…` inside tenant **RW Feedback Local** (`…000000000001`).

| Fixture | Account / record | Purpose |
|---|---|---|
| Guest | no session | Guest-safe routes, AuthGate screens, `/services/requests` → `/login` |
| Normal resident (populated) | `rwfb-populated@test.local` | Complete profile; 1 household member; pending-payment request (`…e1`); paid request with confirmed `qrph` receipt (`…e2`); 1 incident (`…f1`); tenant announcements (2 general, 1 emergency), evacuation center, FAQ, medical drive tomorrow (Asia/Manila) (`…b1`) |
| Empty resident | `rwfb-empty@test.local` | Complete profile with no requests, reports, household, or registrations (empty states) |
| Profile-completion-required | `rwfb-incomplete@test.local` | Profile with only name/tenant; `/reports/new` → `/complete-profile` |
| Inaccessible records | `rwfb-other@test.local` | Owns request `…e3` and incident `…f2`; the populated resident gets 404 / "No confirmed payment receipt" for them |
| Local payment | request `…e1` + browser-mocked Edge Functions | QR generation/poll/cancel without PayMongo; paid receipt `…e2` for receipt-only reads |
| Local registration | drive `…b1` | Health calendar, register drawer/page, obsolete date scenario |

Every fixture resident has no approved ID, so the services verification banner ("Upload a valid ID…") is expected on services routes; request submission journeys that require an approved ID are out of scope for RW-LT-00 and will add an ID fixture in RW-LT-06 if needed (without backend changes).
