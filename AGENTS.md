# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Migration naming

Use sequential four-digit migration prefixes: `NNNN_descriptive_name.sql`, not timestamp prefixes. The last pushed migration is `0094_resident_ios_tenant_write_guards.sql`; pending migrations continue with `0095`, `0096`, and so on. For each new migration, use the next unused number after the highest repository migration prefix. Preserve migration order and never renumber already-pushed migrations.

# Cancelled Android usability phase

The user permanently cancelled Phase 8 (Android usability audit) in `plans/Major_Web_AndroidMobile_Improvement_Plan.md` on 2026-10-06. Never start, resume, or implement that phase. Its actions and section I interaction standards are historical reference only, not authorization for Android UI changes. Do not reintroduce the cancelled work under another phase or as a general refactor. The earlier Phase 8 implementation was reverted; preserve the restored resident Android UI. This cancellation applies to that specific plan, not to identically numbered phases in other plans.
