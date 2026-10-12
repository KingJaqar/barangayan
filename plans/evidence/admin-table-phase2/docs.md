# Documentation and scope read before implementation

- Root and admin-web AGENTS.md; no applicable parent/deeper instruction file found.
- Exact Expo v57 reference: https://docs.expo.dev/versions/v57.0.0/
- Installed Next 16.3 guide: node_modules/next/dist/docs/01-app/01-getting-started/06-fetching-data.md
- Supabase skill and Postgres best practices skill, including security/RLS performance reference.
- Supabase changelog Markdown fetched 2026-10-11; database minor-version and Data API grant changes reviewed:
  - https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes
  - https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- Supabase ordering and row-level security documentation:
  - https://supabase.com/docs/reference/javascript/order
  - https://supabase.com/docs/guides/database/postgres/row-level-security

The required grant changes are handled explicitly. No framework/dependency upgrade or custom operator was introduced. Existing SDK source was inspected for retry opt-out and abort support. No ICU dependency was introduced: query-local lower/whitespace normalization and C collation preserve accents and provide deterministic comparisons. Numeric reference tokens use a tested, non-overflowing database key; stored values/unique constraints remain unchanged.

Initial Git working tree was clean. Highest repository migration was 0109; the new migrations use 0110 and 0111 under the user's sequential-number instruction, which overrides the skill's timestamp-based creation workflow. Migration execution is restricted to the owned schema-copy fixture. Production release belongs to Phase 6.

- PostgREST v14 MATCH operator and filter grammar: https://docs.postgrest.org/en/v14/references/api/tables_views.html
