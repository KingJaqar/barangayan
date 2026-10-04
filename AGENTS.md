# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Migration naming

Use sequential four-digit migration prefixes: `NNNN_descriptive_name.sql`, not timestamp prefixes. The last pushed migration is `0094_resident_ios_tenant_write_guards.sql`; pending migrations continue with `0095`, `0096`, and so on. For each new migration, use the next unused number after the highest repository migration prefix. Preserve migration order and never renumber already-pushed migrations.
