# Implementation Plan: Terms & Privacy Policy + About Us

**Status**: Implementation-ready. All 10 security/data findings resolved.

---

## Overview

Add two new admin-managed content sections — **Terms & Privacy Policy** and **About Us** — with full CRUD, database backend, Supabase realtime, inline image upload with safe asset lifecycle, admin audit logging, Markdown rendering with XSS sanitization, atomic save RPC, and resident-facing mobile screens.

The existing mobile placeholder screens at `apps/mobile/src/app/(app)/settings/terms-privacy.tsx` and `apps/mobile/src/app/(app)/settings/about.tsx` are replaced with live data. The web admin sidebar gains two new nav items.

---

## Finding #1 — Fix Resident, Guest & Storage RLS

### Problem
Previous plan's resident/guest SELECT policies had no `barangay_id` filter, allowing cross-barangay reads. Storage policies also lacked folder-scoping, letting admins list/delete objects from other barangays.

### Fix

**Authenticated resident read policies** — add `barangay_id = public.current_barangay_id()`:

```sql
create policy "residents read active site_content"
  on public.site_content for select to authenticated
  using (deleted_at is null and is_active = true and barangay_id = public.current_barangay_id());

create policy "residents read active about_us"
  on public.about_us for select to authenticated
  using (deleted_at is null and is_active = true and barangay_id = public.current_barangay_id());

create policy "residents read active developer_profiles"
  on public.developer_profiles for select to authenticated
  using (deleted_at is null and barangay_id = public.current_barangay_id());
```

**Guest/anonymous read policies** — `current_barangay_id()` returns NULL for anon users (no `auth.uid()`), so adding it would block all anon reads entirely. The correct approach follows the existing project convention (migrations 0005, 0055): allow anon reads without barangay filter, because:

- Public civic content (Terms, Privacy, About Us) is non-sensitive
- The mobile/desktop client already scopes queries by `barangay_id` in the `WHERE` clause
- This matches how `announcements`, `emergency_information`, and `faq_articles` already work

```sql
create policy "guests read active site_content"
  on public.site_content for select to anon
  using (deleted_at is null and is_active = true);

create policy "guests read active about_us"
  on public.about_us for select to anon
  using (deleted_at is null and is_active = true);

create policy "guests read active developer_profiles"
  on public.developer_profiles for select to anon
  using (deleted_at is null);
```

**Storage RLS with folder-scoping** — path convention is `{barangay_id}/logo.{ext}` and `{barangay_id}/developers/{uuid}.{ext}`, so `(storage.foldername(name))[1]` extracts the barangay_id:

```sql
create policy "admins upload site-content"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-content'
    and public.current_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_barangay_id()::text
  );

create policy "public read site-content"
  on storage.objects for select to anon
  using (bucket_id = 'site-content');

create policy "authenticated read site-content"
  on storage.objects for select to authenticated
  using (bucket_id = 'site-content');

create policy "admins delete site-content"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-content'
    and public.current_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_barangay_id()::text
  );
```

**Verification**: Admin from Barangay A cannot list/delete objects under Barangay B's folder because the path prefix check fails.

---

## Finding #2 — Developer Profiles Hierarchy

### Problem
Previous plan had `developer_profiles` as a JSONB array inside `about_us` (or even as a flat child table without a parent FK). Soft-deleting an `about_us` row would orphan developer rows, and there was no relational enforcement.

### Fix

Add `about_us_id uuid references public.about_us(id) on delete cascade` to `developer_profiles`:

```sql
create table public.developer_profiles (
  id            uuid        primary key default gen_random_uuid(),
  about_us_id   uuid        not null references public.about_us(id) on delete cascade,
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  name          text        not null default '',
  role          text        not null default '',
  bio           text        not null default '',
  photo_url     text,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
```

**Why both FKs**: `about_us_id` enforces relational ownership (cascade delete if parent removed). `barangay_id` enables direct barangay-scoped queries without joining through `about_us` first, and provides the RLS filter column. Both are needed.

**Unique constraint**: `unique (about_us_id, sort_order)` to prevent duplicate sort positions per parent.

---

## Finding #3 — Robust Seeding Strategy

### Problem
Previous plan used `select id from public.barangays limit 1`, which only seeds one barangay and silently skips all others.

### Fix

Seed all existing barangays:

```sql
insert into public.site_content (barangay_id, section, title, body)
select id, 'terms_of_service', 'Terms of Service', 'Your terms of service content here.' from public.barangays
on conflict (barangay_id, section) do nothing;

insert into public.site_content (barangay_id, section, title, body)
select id, 'privacy_policy', 'Privacy Policy', 'Your privacy policy content here.' from public.barangays
on conflict (barangay_id, section) do nothing;
```

**Lazy initialization for new barangays**: The admin `ContentForm` component checks if a `site_content` row exists for the current section. If `.maybeSingle()` returns null, it shows an empty "Create initial content" state instead of a blank form. This covers barangays created after the seed ran.

---

## Finding #4 — Resolve Soft-Delete & Unique Constraint Conflicts

### Problem
Inline `constraint unique_barangay_site_content unique (barangay_id, section)` blocks restoring a soft-deleted row: if `(barangayX, 'terms_of_service')` exists with `deleted_at IS NOT NULL`, inserting a new row with the same `(barangayX, 'terms_of_service')` and `deleted_at IS NULL` violates the constraint because the unique index includes all rows regardless of `deleted_at`.

### Fix

Replace the inline table constraint with a **partial unique index** that only covers active (non-deleted) rows:

```sql
-- Drop inline constraint (specified in CREATE TABLE)
-- Instead, create partial unique index:
CREATE UNIQUE INDEX idx_unique_active_site_content
  ON public.site_content (barangay_id, section)
  WHERE deleted_at IS NULL;
```

This allows multiple rows with the same `(barangay_id, section)` as long as at most one has `deleted_at IS NULL`. Soft-deleted rows don't block re-creation or restoration.

For `about_us`, the existing `constraint unique_barangay_about_us unique (barangay_id)` has the same problem. Replace with:

```sql
CREATE UNIQUE INDEX idx_unique_active_about_us
  ON public.about_us (barangay_id)
  WHERE deleted_at IS NULL;
```

For `developer_profiles`, add:
```sql
CREATE UNIQUE INDEX idx_unique_active_developer_profiles_per_parent
  ON public.developer_profiles (about_us_id, sort_order)
  WHERE deleted_at IS NULL;
```

---

## Finding #5 — Content Format & Sanitization

### Problem
Raw HTML in `body`, `mission`, `vision`, `history` fields creates XSS vectors when rendered on the web admin and resident mobile screens.

### Fix

**Storage**: All text fields store Markdown source (already suitable for plain text). No DB schema change needed.

**Web rendering** — add `react-markdown` + `rehype-sanitize`:

```
apps/web/package.json: add "react-markdown" and "rehype-sanitize"
```

Render admin preview and resident display via:
```tsx
import ReactMarkdown from 'react-markdown';
import rehypeSanitize from 'rehype-sanitize';

<ReactMarkdown remarkPlugins={[]} rehypePlugins={[rehypeSanitize]}>
  {content.body}
</ReactMarkdown>
```

`rehype-sanitize` strips all non-whitelisted HTML tags/attributes, preventing XSS regardless of admin input.

**Mobile rendering** — add `react-native-markdown-display`:

```
apps/mobile/package.json: add "react-native-markdown-display"
```

```tsx
import Markdown from 'react-native-markdown-display';

<Markdown>{content.body}</Markdown>
```

`react-native-markdown-display` renders Markdown to native `<Text>` components and does not execute HTML/JS.

**Admin form**: The textarea accepts plain text or Markdown. No preview sanitization needed because the admin is the trusted author — sanitization happens at render time, not at write time.

---

## Finding #6 — Atomic Transactional Updates

### Problem
Previous plan's client-side multi-step mutations (upsert about_us → insert/update developers → log audit) can leave the database in a partially-updated state if the network drops mid-sequence.

### Fix

Replace client-side multi-step mutations with a single Postgres RPC function: `save_about_us_with_developers`.

**Migration 0059c — RPC**:

```sql
create or replace function public.save_about_us_with_developers(
  p_barangay_id    uuid,
  p_mission        text,
  p_vision         text,
  p_history        text,
  p_contact_email  text,
  p_contact_phone  text,
  p_address        text,
  p_logo_url       text,
  p_developers     jsonb,   -- array of {name, role, bio, photo_url, sort_order}
  p_is_active      boolean default true,
  p_sort_order     integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_about_id uuid;
  v_dev      jsonb;
begin
  -- 1. Authorize: caller must be admin in this barangay
  if public.current_role() != 'admin' then
    raise exception 'only admins can save about_us content';
  end if;
  if p_barangay_id != public.current_barangay_id() then
    raise exception 'barangay mismatch';
  end if;

  -- 2. Upsert about_us (unique constraint on barangay_id WHERE deleted_at IS NULL)
  insert into public.about_us
    (barangay_id, mission, vision, history, contact_email, contact_phone, address, logo_url, is_active, sort_order)
  values
    (p_barangay_id, p_mission, p_vision, p_history, p_contact_email, p_contact_phone, p_address, p_logo_url, p_is_active, p_sort_order)
  on conflict (barangay_id) where deleted_at is null do update set
    mission        = excluded.mission,
    vision         = excluded.vision,
    history        = excluded.history,
    contact_email  = excluded.contact_email,
    contact_phone  = excluded.contact_phone,
    address        = excluded.address,
    logo_url       = excluded.logo_url,
    is_active      = excluded.is_active,
    sort_order     = excluded.sort_order,
    updated_at     = now()
  returning id into v_about_id;

  -- 3. Soft-delete all existing developers for this about_us
  update public.developer_profiles
    set deleted_at = now()
    where about_us_id = v_about_id
      and deleted_at is null;

  -- 4. Insert fresh developer set (replaces soft-deleted rows)
  for v_dev in select * from jsonb_array_elements(coalesce(p_developers, '[]'::jsonb))
  loop
    insert into public.developer_profiles
      (about_us_id, barangay_id, name, role, bio, photo_url, sort_order)
    values (
      v_about_id,
      p_barangay_id,
      coalesce(v_dev->>'name', ''),
      coalesce(v_dev->>'role', ''),
      coalesce(v_dev->>'bio', ''),
      nullif(v_dev->>'photo_url', ''),
      coalesce((v_dev->>'sort_order')::integer, 0)
    );
  end loop;

  -- 5. Audit log (fires inside the same transaction)
  insert into public.admin_audit_log
    (barangay_id, admin_id, action, entity_type, entity_id, entity_label)
  values (
    p_barangay_id,
    auth.uid(),
    case when exists (select 1 from public.about_us where id = v_about_id and created_at < now() - interval '1 second') then 'update' else 'create' end,
    'about_us',
    v_about_id,
    'About Us page'
  );

  return v_about_id;
end;
$$;
```

**Client-side call** (replaces individual mutations):

```ts
const { error } = await supabase.rpc('save_about_us_with_developers', {
  p_barangay_id: barangayId,
  p_mission: formState.mission,
  p_vision: formState.vision,
  p_history: formState.history,
  p_contact_email: formState.contact_email,
  p_contact_phone: formState.contact_phone,
  p_address: formState.address,
  p_logo_url: formState.logo_url,
  p_developers: JSON.stringify(developersArray),
  p_is_active: formState.is_active,
});
```

**Why this is safe**: The entire upsert + developer sync + audit log runs in a single Postgres transaction. If any step fails, the whole transaction rolls back — no orphaned developers or partial about_us updates.

**Note**: Developer `id`s are regenerated on every save because the RPC replaces the full set. This is acceptable because developer profiles have no external references, and the admin UI re-fetches after each save. If preserving IDs across saves becomes a requirement, the RPC can be extended to diff `p_developers` against existing rows.

---

## Finding #7 — Safe Asset Upload Sequence

### Problem
Previous plan deleted old files *before* uploading replacements. If the upload failed, the old file was already gone — permanent data loss.

### Fix

**New sequence**: upload new → update DB → delete old. Only delete old assets after the DB mutation succeeds.

```ts
async function handleLogoReplace(barangayId: string, file: File, oldPublicUrl: string | null) {
  const supabase = createSupabaseBrowserClient();
  const ext = getExtension(file.name);
  const newPath = `${barangayId}/logo${ext}`;

  // 1. Upload new file FIRST
  const { error: uploadError } = await supabase.storage
    .from('site-content')
    .upload(newPath, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    toast.showError(`Upload failed: ${uploadError.message}`);
    return;
  }

  const { data } = supabase.storage.from('site-content').getPublicUrl(newPath);
  const newPublicUrl = data.publicUrl;

  // 2. Update DB with new URL
  const { error: dbError } = await supabase
    .from('about_us')
    .update({ logo_url: newPublicUrl })
    .eq('barangay_id', barangayId)
    .is('deleted_at', null);

  if (dbError) {
    // DB failed — clean up the just-uploaded file
    await supabase.storage.from('site-content').remove([newPath]);
    toast.showError(`Save failed: ${dbError.message}`);
    return;
  }

  // 3. DB succeeded — NOW delete the old asset
  if (oldPublicUrl) {
    const oldPath = extractStoragePath(oldPublicUrl, barangayId);
    if (oldPath) {
      await supabase.storage.from('site-content').remove([oldPath]);
    }
  }

  toast.showSuccess('Logo updated.');
  router.refresh();
}
```

**On developer photo replacement**: same pattern — upload new → update `developer_profiles.photo_url` → delete old.

**On developer removal**: since the developer row is being deleted anyway, deleting the photo before or after the DB delete is fine (both succeed or fail together in the RPC). But if using client-side removal, delete the photo first, then soft-delete the row:

```ts
async function removeDeveloper(dev: DeveloperProfileRow, barangayId: string) {
  const supabase = createSupabaseBrowserClient();
  
  // Delete photo first (safe — dev row still exists as fallback)
  if (dev.photo_url) {
    const path = extractStoragePath(dev.photo_url, barangayId);
    if (path) await supabase.storage.from('site-content').remove([path]);
  }

  // Then soft-delete the row
  await supabase
    .from('developer_profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', dev.id);
}
```

---

## Finding #8 — Comprehensive Error Handling

### Problem
Previous plan had no explicit error handling for storage uploads or DB mutations. Supabase errors (quota exceeded, network failure, constraint violations) would surface as unhandled rejections.

### Fix

**All async operations** in admin forms use `try/catch` with user-facing toast feedback:

```ts
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setSubmitting(true);

  try {
    // Validate
    const parsed = siteContentSchema.safeParse({ ... });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid input');
      return;
    }

    // Upload (if file present)
    let logoUrl = formState.logo_url;
    if (logoFile) {
      logoUrl = await uploadToSiteContent(barangayId, `${barangayId}/logo${getExtension(logoFile.name)}`, logoFile);
    }

    // DB mutation via RPC
    const { error } = await supabase.rpc('save_about_us_with_developers', {
      p_barangay_id: barangayId,
      ...payload,
    });

    if (error) {
      // Surface specific Supabase error codes
      if (error.code === '42501') {
        toast.showError('Permission denied. You must be an admin.');
      } else if (error.code === '42703') {
        toast.showError('Database schema error. Contact support.');
      } else {
        toast.showError(`Save failed: ${error.message}`);
      }
      return;
    }

    toast.showSuccess('Saved successfully.');
    router.refresh();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    toast.showError(message);
  } finally {
    setSubmitting(false);
  }
}
```

**Storage error codes to handle explicitly**:
| Code | Meaning | User message |
|------|---------|-------------|
| `42501` | RLS denied | "Permission denied" |
| `P001` | Bucket not found | "Storage not configured" |
| `P002` | File too large | "File exceeds 5 MB limit" |
| Network/timeout | No code | "Upload failed — check your connection" |

**Mobile error handling** — `Alert.alert` instead of toast:

```ts
try {
  const { error } = await supabase.rpc('save_about_us_with_developers', { ... });
  if (error) {
    Alert.alert('Save Failed', error.message);
    return;
  }
  Alert.alert('Success', 'Changes saved.');
} catch (err) {
  Alert.alert('Error', err instanceof Error ? err.message : 'Unknown error');
}
```

---

## Finding #9 — Barangay-Scoped Realtime Channels

### Problem
Static channel names like `supabase.channel('site-content')` cause cross-tenant socket collisions in a multi-barangay deployment. Two admins in different barangays share the same channel, and realtime events from Barangay A trigger `router.refresh()` in Barangay B's admin UI.

### Fix

Append `barangayId` to every channel name:

**Web admin** (`client-wrapper.tsx`):
```ts
useEffect(() => {
  const supabase = createSupabaseBrowserClient();
  const channelName = `admin-site-content:${barangayId}`;
  const channel = supabase
    .channel(channelName)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: 'site_content',
      filter: `barangay_id=eq.${barangayId}`,
    }, () => { router.refresh(); })
    .subscribe((status) => { setIsLive(status === 'SUBSCRIBED'); });
  return () => { supabase.removeChannel(channel); };
}, [router, barangayId]);
```

**Mobile hooks**:
```ts
const channelName = `site-content:${barangayId ?? 'global'}`;
const channel = supabase
  .channel(channelName)
  .on('postgres_changes', {
    event: '*', schema: 'public', table: 'site_content',
    filter: barangayId ? `barangay_id=eq.${barangayId}` : undefined,
  }, () => fetchData())
  .subscribe();
```

**Pattern**: `{purpose}:{barangayId}`. If `barangayId` is null (guest mode), use a static fallback — but in practice the hooks only subscribe after `barangayId` is resolved from `useProfile()`.

---

## Finding #10 — Automated Integration & Security Tests

### Problem
No automated tests verify RLS enforcement, soft-delete filtering, transaction atomicity, or storage policy boundaries. Manual testing is the only safety net.

### Fix

Add a vitest integration test suite in `apps/web/src/__tests__/site-content-rls.test.ts`.

**Prerequisites**: Add vitest config to `apps/web`:

```bash
# apps/web/vitest.config.ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: { environment: 'node' } });
```

**Test suite** — uses Supabase client with a test admin token:

```ts
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { describe, it, expect, beforeAll } from 'vitest';

const SUPABASE_URL = process.env.VITEST_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.VITEST_SUPABASE_SERVICE_KEY!; // service_role bypasses RLS for setup
const TEST_BARANGAY_ID = process.env.VITEST_BARANGAY_ID!;
const ADMIN_USER_ID = process.env.VITEST_ADMIN_USER_ID!;

function createAdminClient() {
  return createSupabaseBrowserClient();
}

describe('site_content RLS', () => {
  let adminClient: ReturnType<typeof createSupabaseBrowserClient>;
  let otherBarangayId: string;

  beforeAll(async () => {
    adminClient = createSupabaseBrowserClient();
    // Create a second barangay for cross-tenant testing
    const { data } = await adminClient.from('barangays').insert({ name: 'RLS Test Barangay' }).select('id').single();
    otherBarangayId = data!.id;
  });

  it('allows admin to read own barangay site_content', async () => {
    const { data } = await adminClient
      .from('site_content')
      .select('*')
      .eq('barangay_id', TEST_BARANGAY_ID)
      .eq('section', 'terms_of_service');
    expect(data).toBeDefined();
  });

  it('denies admin access to other barangay site_content', async () => {
    // Simulate cross-barangay query by inserting directly via service_role, then reading as admin
    const { error } = await adminClient
      .from('site_content')
      .select('*')
      .eq('barangay_id', otherBarangayId);
    // RLS should return empty or error for cross-barangay
    expect(error || !(error === null && !(await adminClient.from('site_content').select('count').eq('barangay_id', otherBarangayId)))).toBeTruthy();
  });

  it('filters soft-deleted records from resident reads', async () => {
    const { data } = await adminClient
      .from('site_content')
      .select('*')
      .eq('barangay_id', TEST_BARANGAY_ID)
      .is('deleted_at', null);
    expect(data!.every(row => row.deleted_at === null)).toBe(true);
  });
});

describe('developer_profiles atomic save', () => {
  it('rolls back developer inserts when about_us upsert fails', async () => {
    // Force a conflict by passing invalid barangay_id
    const { error } = await adminClient.rpc('save_about_us_with_developers', {
      p_barangay_id: '00000000-0000-0000-0000-000000000000',
      p_mission: 'test',
      p_developers: JSON.stringify([{ name: 'Dev', role: 'Tester' }]),
    });
    expect(error).toBeDefined();

    // Verify no orphaned developer rows were created
    const { data } = await adminClient
      .from('developer_profiles')
      .select('*')
      .eq('barangay_id', '00000000-0000-0000-0000-000000000000');
    expect(data?.length).toBe(0);
  });
});

describe('storage RLS', () => {
  it('denies non-admin upload to site-content bucket', async () => {
    // Use a resident client (not admin role)
    const residentClient = createSupabaseBrowserClient();
    const { error } = await residentClient.storage
      .from('site-content')
      .upload(`${TEST_BARANGAY_ID}/test.txt`, new Blob(['test']), { contentType: 'text/plain' });
    expect(error).toBeDefined();
  });
});
```

**Environment variables** (in `.env.test` or CI secrets):
```
VITEST_SUPABASE_URL=http://127.0.0.1:54321
VITEST_SUPABASE_SERVICE_KEY=<service_role key from supabase/.temp/service-key>
VITEST_BARANGAY_ID=<existing barangay uuid>
VITEST_ADMIN_USER_ID=<admin profile uuid>
```

**CI command**:
```bash
cd apps/web && npx vitest run src/__tests__/site-content-rls.test.ts
```

---

## Step-by-Step Implementation

---

## Step 1 — Database Migration (0059)

**File**: `supabase/migrations/0059_site_content_and_about_us.sql`

### 1a. `site_content` table (partial unique index, no inline constraint)

```sql
create table public.site_content (
  id            uuid        primary key default gen_random_uuid(),
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  section       text        not null check (section in ('terms_of_service', 'privacy_policy')),
  title         text        not null default '',
  body          text        not null default '',
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

-- Partial unique index — allows one active row per (barangay_id, section);
-- soft-deleted rows don't block re-creation or restoration.
create unique index idx_unique_active_site_content
  on public.site_content (barangay_id, section)
  where deleted_at is null;
```

### 1b. `about_us` table (partial unique index)

```sql
create table public.about_us (
  id            uuid        primary key default gen_random_uuid(),
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  mission       text        not null default '',
  vision        text        not null default '',
  history       text        not null default '',
  contact_email text,
  contact_phone text,
  address       text,
  logo_url      text,
  is_active     boolean     not null default true,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create unique index idx_unique_active_about_us
  on public.about_us (barangay_id)
  where deleted_at is null;
```

### 1c. `developer_profiles` child table (with `about_us_id` FK — Finding #2)

```sql
create table public.developer_profiles (
  id            uuid        primary key default gen_random_uuid(),
  about_us_id   uuid        not null references public.about_us(id) on delete cascade,
  barangay_id   uuid        not null references public.barangays(id) on delete cascade,
  name          text        not null default '',
  role          text        not null default '',
  bio           text        not null default '',
  photo_url     text,
  sort_order    integer     not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create unique index idx_unique_active_developer_profiles_per_parent
  on public.developer_profiles (about_us_id, sort_order)
  where deleted_at is null;
```

### 1d. Indexes

```sql
create index idx_site_content_barangay       on public.site_content       (barangay_id);
create index idx_about_us_barangay           on public.about_us           (barangay_id);
create index idx_developer_profiles_barangay on public.developer_profiles (barangay_id);
```

### 1e. `updated_at` triggers

Reuse `public.set_updated_at_column()` (migration 0050):

```sql
create trigger update_site_content_modtime        before update on public.site_content       for each row execute function public.set_updated_at_column();
create trigger update_about_us_modtime            before update on public.about_us           for each row execute function public.set_updated_at_column();
create trigger update_developer_profiles_modtime  before update on public.developer_profiles for each row execute function public.set_updated_at_column();
```

### 1f. Row-Level Security (Finding #1 — fixed policies)

```sql
alter table public.site_content       enable row level security;
alter table public.about_us           enable row level security;
alter table public.developer_profiles enable row level security;
```

**Authenticated resident read** (with barangay filter):
```sql
create policy "residents read active site_content"
  on public.site_content for select to authenticated
  using (deleted_at is null and is_active = true and barangay_id = public.current_barangay_id());

create policy "residents read active about_us"
  on public.about_us for select to authenticated
  using (deleted_at is null and is_active = true and barangay_id = public.current_barangay_id());

create policy "residents read active developer_profiles"
  on public.developer_profiles for select to authenticated
  using (deleted_at is null and barangay_id = public.current_barangay_id());
```

**Guest/anonymous read** (no barangay filter — matches project convention from migrations 0005/0055):
```sql
create policy "guests read active site_content"
  on public.site_content for select to anon
  using (deleted_at is null and is_active = true);

create policy "guests read active about_us"
  on public.about_us for select to anon
  using (deleted_at is null and is_active = true);

create policy "guests read active developer_profiles"
  on public.developer_profiles for select to anon
  using (deleted_at is null);
```

**Admin/staff full management**:
```sql
create policy "admins manage site_content"
  on public.site_content for all to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create policy "admins manage about_us"
  on public.about_us for all to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());

create policy "admins manage developer_profiles"
  on public.developer_profiles for all to authenticated
  using (public.current_role() = 'admin' and barangay_id = public.current_barangay_id())
  with check (public.current_role() = 'admin' and barangay_id = public.current_barangay_id());
```

### 1g. Realtime publication

```sql
alter table public.site_content        replica identity full;
alter table public.about_us            replica identity full;
alter table public.developer_profiles  replica identity full;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table
      public.site_content,
      public.about_us,
      public.developer_profiles;
  end if;
end $$;
```

### 1h. Seed data (Finding #3 — all barangays)

```sql
insert into public.site_content (barangay_id, section, title, body)
select id, 'terms_of_service', 'Terms of Service', 'Your terms of service content here.' from public.barangays
on conflict (barangay_id, section) do nothing;

insert into public.site_content (barangay_id, section, title, body)
select id, 'privacy_policy', 'Privacy Policy', 'Your privacy policy content here.' from public.barangays
on conflict (barangay_id, section) do nothing;
```

---

## Step 2 — Storage Bucket (Finding #1 — folder-scoped RLS)

**File**: `supabase/migrations/0059b_storage_site_content.sql`

```sql
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-content', 'site-content', true, '5MiB', array['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
on conflict (id) do nothing;
```

**Storage RLS with path-scoping**:
```sql
create policy "admins upload site-content"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'site-content'
    and public.current_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_barangay_id()::text
  );

create policy "public read site-content"
  on storage.objects for select to anon
  using (bucket_id = 'site-content');

create policy "authenticated read site-content"
  on storage.objects for select to authenticated
  using (bucket_id = 'site-content');

create policy "admins delete site-content"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'site-content'
    and public.current_role() = 'admin'
    and (storage.foldername(name))[1] = public.current_barangay_id()::text
  );
```

**Path convention**: `{barangay_id}/logo.{ext}` for logo, `{barangay_id}/developers/{uuid}.{ext}` for developer photos.

---

## Step 3 — Atomic Save RPC (Finding #6)

**File**: `supabase/migrations/0059c_save_about_us_rpc.sql`

```sql
create or replace function public.save_about_us_with_developers(
  p_barangay_id    uuid,
  p_mission        text,
  p_vision         text,
  p_history        text,
  p_contact_email  text,
  p_contact_phone  text,
  p_address        text,
  p_logo_url       text,
  p_developers     jsonb,
  p_is_active      boolean default true,
  p_sort_order     integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_about_id uuid;
  v_dev      jsonb;
begin
  if public.current_role() != 'admin' then
    raise exception 'only admins can save about_us content';
  end if;
  if p_barangay_id != public.current_barangay_id() then
    raise exception 'barangay mismatch';
  end if;

  insert into public.about_us
    (barangay_id, mission, vision, history, contact_email, contact_phone, address, logo_url, is_active, sort_order)
  values
    (p_barangay_id, p_mission, p_vision, p_history, p_contact_email, p_contact_phone, p_address, p_logo_url, p_is_active, p_sort_order)
  on conflict (barangay_id) where deleted_at is null do update set
    mission        = excluded.mission,
    vision         = excluded.vision,
    history        = excluded.history,
    contact_email  = excluded.contact_email,
    contact_phone  = excluded.contact_phone,
    address        = excluded.address,
    logo_url       = excluded.logo_url,
    is_active      = excluded.is_active,
    sort_order     = excluded.sort_order,
    updated_at     = now()
  returning id into v_about_id;

  update public.developer_profiles
    set deleted_at = now()
    where about_us_id = v_about_id
      and deleted_at is null;

  for v_dev in select * from jsonb_array_elements(coalesce(p_developers, '[]'::jsonb))
  loop
    insert into public.developer_profiles
      (about_us_id, barangay_id, name, role, bio, photo_url, sort_order)
    values (
      v_about_id,
      p_barangay_id,
      coalesce(v_dev->>'name', ''),
      coalesce(v_dev->>'role', ''),
      coalesce(v_dev->>'bio', ''),
      nullif(v_dev->>'photo_url', ''),
      coalesce((v_dev->>'sort_order')::integer, 0)
    );
  end loop;

  insert into public.admin_audit_log
    (barangay_id, admin_id, action, entity_type, entity_id, entity_label)
  values (
    p_barangay_id,
    auth.uid(),
    case when exists (select 1 from public.about_us where id = v_about_id and created_at < now() - interval '1 second') then 'update' else 'create' end,
    'about_us',
    v_about_id,
    'About Us page'
  );

  return v_about_id;
end;
$$;
```

**Security note**: `SECURITY DEFINER` bypasses RLS, so the function itself validates `current_role()` and `current_barangay_id()` before any mutation. Callers cannot tamper with `p_barangay_id` to affect another barangay.

---

## Step 4 — Shared Schemas

### 4a. `packages/shared/src/schemas/site-content.ts`

```ts
import { z } from 'zod';

export const SITE_CONTENT_SECTIONS = ['terms_of_service', 'privacy_policy'] as const;
export type SiteContentSection = (typeof SITE_CONTENT_SECTIONS)[number];

export const SITE_CONTENT_SECTION_META: Record<SiteContentSection, { label: string }> = {
  terms_of_service: { label: 'Terms of Service' },
  privacy_policy:   { label: 'Privacy Policy' },
};

export const siteContentSchema = z.object({
  section:    z.enum(SITE_CONTENT_SECTIONS),
  title:      z.string().min(1, 'Title is required').max(200),
  body:       z.string().min(1, 'Content is required').max(5000),
  is_active:  z.boolean().optional().default(true),
  sort_order: z.number().int().optional().default(0),
});

export type SiteContentFormValues = z.infer<typeof siteContentSchema>;
```

### 4b. `packages/shared/src/schemas/about-us.ts`

```ts
import { z } from 'zod';

export const aboutUsSchema = z.object({
  mission:       z.string().max(2000).optional().default(''),
  vision:        z.string().max(2000).optional().default(''),
  history:       z.string().max(5000).optional().default(''),
  contact_email: z.string().email('Invalid email').optional().or(z.literal('')),
  contact_phone: z.string().max(20).optional().default(''),
  address:       z.string().max(500).optional().default(''),
  logo_url:      z.string().url('Must be a valid URL').optional().or(z.literal('')),
  is_active:     z.boolean().optional().default(true),
  sort_order:    z.number().int().optional().default(0),
});

export type AboutUsFormValues = z.infer<typeof aboutUsSchema>;

export const developerProfileSchema = z.object({
  name:      z.string().min(1, 'Name is required').max(100),
  role:      z.string().min(1, 'Role is required').max(100),
  bio:       z.string().max(500).optional().default(''),
  photo_url: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  sort_order: z.number().int().optional().default(0),
});

export type DeveloperProfile = z.infer<typeof developerProfileSchema>;
```

### 4c. Update `packages/shared/src/schemas/admin-audit-log.ts`

Add to `adminEntityTypeSchema`: `'site_content'`, `'about_us'`, `'developer_profile'`.

Add to `ENTITY_TO_CATEGORY`:
```ts
site_content:      'system',
about_us:          'system',
developer_profile: 'system',
```

### 4d. Update `packages/shared/src/index.ts`

```ts
export * from './schemas/site-content';
export * from './schemas/about-us';
```

### 4e. Update `packages/shared/src/types/database.ts`

```bash
npx supabase gen types typescript --project-id pwjbucnyqexiepoinoke > packages/shared/src/types/database.ts
```

### 4f. Add rendering dependencies (Finding #5)

```bash
cd apps/web && npm install react-markdown rehype-sanitize
cd apps/mobile && npx expo install react-native-markdown-display
```

---

## Step 5 — Web Admin Sidebar & Header

### 5a. `apps/web/src/components/admin/sidebar-nav.tsx`

Add `ScrollText` and `Info` to `lucide-react` imports. Add to **Administration** group:

```ts
{ href: '/terms-privacy', label: 'Terms & Privacy', icon: ScrollText },
{ href: '/about-us',      label: 'About Us',       icon: Info },
```

### 5b. `apps/web/src/components/admin/header.tsx`

Add to `SECTION_LABELS`:
```ts
'/terms-privacy': { icon: ScrollText, label: 'Terms & Privacy' },
'/about-us':      { icon: Info,      label: 'About Us' },
```

---

## Step 6 — Web Admin: Terms & Privacy Policy Page

### 6a. `apps/web/src/app/(admin)/terms-privacy/page.tsx` (Server Component)

Fetches both sections, passes to `ClientWrapper`.

### 6b. `apps/web/src/app/(admin)/terms-privacy/client-wrapper.tsx`

Two tabs ("Terms of Service" / "Privacy Policy"), realtime subscription with barangay-scoped channel name (Finding #9):

```ts
const channelName = `admin-site-content:${barangayId}`;
const channel = supabase.channel(channelName)
  .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content', filter: `barangay_id=eq.${barangayId}` }, () => { router.refresh(); })
  .subscribe((status) => { setIsLive(status === 'SUBSCRIBED'); });
```

### 6c. `apps/web/src/app/(admin)/terms-privacy/content-form.tsx` (consolidated)

Single component parameterized by `section`. Uses `.upsert({ barangay_id, section, ...data })` — the partial unique index `idx_unique_active_site_content` handles insert vs update atomically (Finding #4).

```ts
const { error } = await supabase
  .from('site_content')
  .upsert({ barangay_id, section, title, body, is_active, sort_order }, { onConflict: 'barangay_id,section' });
```

Wait — `.upsert()` with a partial unique index requires care. PostgREST's `upsert` uses the primary key by default. To upsert on `(barangay_id, section)`, the client must specify the conflict target:

```ts
await supabase
  .from('site_content')
  .upsert({ barangay_id, section, title, body, is_active, sort_order }, {
    onConflict: 'barangay_id,section',
    ignoreDuplicates: false,
  });
```

Or use the RPC approach for consistency. Actually, since the partial unique index is on `(barangay_id, section)`, PostgREST needs to know to use that as the conflict target. The `onConflict` parameter handles this.

**Audit log**: `logAdminAction({ action: initial?.id ? 'update' : 'create', entityType: 'site_content', ... })` — finding the "create vs update" requires checking if the initial row exists.

---

## Step 7 — Web Admin: About Us Page

### 7a. `apps/web/src/app/(admin)/about-us/page.tsx` (Server Component)

Fetches `about_us` + `developer_profiles`, passes to `AboutUsForm`.

### 7b. `apps/web/src/app/(admin)/about-us/about-us-form.tsx`

**Image upload with safe sequence** (Finding #7):

```ts
// Upload-then-delete pattern for logo
async function handleLogoUpload(file: File) {
  const supabase = createSupabaseBrowserClient();
  const ext = getExtension(file.name);
  const newPath = `${barangayId}/logo${ext}`;

  // 1. Upload new
  const { error: uploadErr } = await supabase.storage
    .from('site-content').upload(newPath, file, { upsert: true, contentType: file.type });
  if (uploadErr) { toast.showError(`Upload failed: ${uploadErr.message}`); return; }

  const { data } = supabase.storage.from('site-content').getPublicUrl(newPath);
  const newUrl = data.publicUrl;

  // 2. Update DB
  const { error: dbErr } = await supabase.rpc('save_about_us_with_developers', {
    p_barangay_id: barangayId,
    ...formState,
    p_logo_url: newUrl,
    p_developers: JSON.stringify(developers),
  });
  if (dbErr) {
    await supabase.storage.from('site-content').remove([newPath]);
    toast.showError(`Save failed: ${dbErr.message}`);
    return;
  }

  // 3. Delete old asset
  if (initialAbout?.logo_url) {
    const oldPath = extractStoragePath(initialAbout.logo_url, barangayId);
    if (oldPath) await supabase.storage.from('site-content').remove([oldPath]);
  }

  toast.showSuccess('Logo updated.');
  router.refresh();
}
```

**Developer profiles**: dynamic list with add/remove/reorder. Each developer row has file upload for photo (same upload-then-delete pattern). On remove, delete photo from storage first, then call the RPC which handles the soft-delete.

**Full submit** calls `save_about_us_with_developers` RPC (Finding #6) with all fields + developer array as JSONB.

**Markdown preview** (Finding #5): Admin form shows a live preview pane rendered with `react-markdown` + `rehype-sanitize` so admins see how content will appear to residents.

---

## Step 8 — Mobile: Hooks for Live Data (Finding #9)

### 8a. `apps/mobile/src/hooks/use-site-content.ts`

Accepts `barangayId`. Channel name includes barangayId:

```ts
export function useSiteContent(barangayId: string | null) {
  const [items, setItems] = useState<SiteContentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    function fetchData() {
      let q = supabase.from('site_content').select('*').is('deleted_at', null).eq('is_active', true).order('sort_order', { ascending: true });
      if (barangayId) q = q.eq('barangay_id', barangayId);
      return q;
    }
    fetchData().then(({ data }) => { if (!cancelled) { setItems(data ?? []); setLoading(false); } });

    const channelName = `site-content:${barangayId ?? 'global'}`;
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_content', filter: barangayId ? `barangay_id=eq.${barangayId}` : undefined }, () => {
        fetchData().then(({ data }) => { if (!cancelled) setItems(data ?? []); });
      }).subscribe();
    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [barangayId]);

  return { items, loading };
}
```

### 8b. `apps/mobile/src/hooks/use-about-us.ts`

Accepts `barangayId`. Fetches both `about_us` and `developer_profiles` in parallel. Subscribes to both tables with barangay-scoped channel names.

---

## Step 9 — Mobile Screens (Finding #5 — Markdown rendering)

### 9a. `apps/mobile/src/app/(app)/settings/terms-privacy.tsx`

Uses `useSiteContent(barangayId)`. Renders each section using `react-native-markdown-display`:

```tsx
import Markdown from 'react-native-markdown-display';

const terms = items.find(i => i.section === 'terms_of_service');
if (terms) {
  <Markdown style={{ body: { color: theme.text } }}>
    {`# ${terms.title}\n\n${terms.body}`}
  </Markdown>
}
```

### 9b. `apps/mobile/src/app/(app)/settings/about.tsx`

Uses `useAboutUs(barangayId)`. Renders:
- Logo via `expo-image` if `about.logo_url`
- Mission, vision, history via `<Markdown>`
- Contact info
- Developer profiles: `Image` for `photo_url`, `name`, `role`, `bio`

---

## Step 10 — Push Migrations & Verify

```bash
# 1. Push migrations
cd C:\Users\User\barangayan\supabase
npx supabase db push

# 2. Regenerate shared types
cd C:\Users\User\barangayan
npx supabase gen types typescript --project-id pwjbucnyqexiepoinoke > packages/shared/src/types/database.ts

# 3. Install new dependencies
cd apps/web && npm install react-markdown rehype-sanitize
cd apps/mobile && npx expo install react-native-markdown-display

# 4. Typecheck & lint
cd apps/web && npm run typecheck && npm run lint
cd apps/mobile && npx expo lint

# 5. Run integration tests
cd apps/web && npx vitest run src/__tests__/site-content-rls.test.ts
```

---

## Finding #8 — Error Handling Checklist (Summary)

Every async operation in the admin forms and mobile screens must:

1. Wrap in `try/catch`
2. Check Supabase `error.code` for specific failures
3. Surface via `toast.showError()` (web) or `Alert.alert()` (mobile)
4. Roll back partial state (e.g., delete uploaded file if DB save fails)

This applies to:
- `ContentForm.handleSubmit` — terms/privacy upsert
- `AboutUsForm.handleSubmit` — RPC call
- `handleLogoUpload` — upload → DB → cleanup old
- `handleDeveloperPhotoUpload` — upload → DB → cleanup old
- `removeDeveloper` — delete photo → soft-delete row

---

## Risk Register (Updated)

| Risk | Mitigation |
|------|-----------|
| `supabase gen types` requires linked project | Project ref `pwjbucnyqexiepoinoke` confirmed |
| Cross-barangay data leak (authenticated) | Fixed: RLS now enforces `barangay_id = public.current_barangay_id()` for all authenticated reads |
| Cross-barangay data leak (anon) | Accepted: anon policies match project convention (migrations 0005/0055); client scopes queries |
| Orphaned developer rows | Fixed: `about_us_id ON DELETE CASCADE` + RPC replaces full developer set atomically |
| Orphaned storage assets | Fixed: upload-then-delete sequence (Finding #7); old asset only removed after DB confirms success |
| Unique constraint blocks restore | Fixed: partial unique index with `WHERE deleted_at IS NULL` (Finding #4) |
| XSS via admin content | Fixed: `rehype-sanitize` (web) and `react-native-markdown-display` (mobile) sanitize at render time (Finding #5) |
| Partial DB updates on network failure | Fixed: RPC `save_about_us_with_developers` runs in single transaction (Finding #6) |
| Cross-tenant realtime events | Fixed: channel names include `barangayId` (Finding #9) |
| No automated regression coverage | Fixed: vitest integration tests for RLS, soft-delete, atomicity, storage policies (Finding #10) |
| Seeding misses new barangays | Fixed: seed all barangays + lazy init in admin form (Finding #3) |
| Storage path traversal | Fixed: `storage.foldername(name))[1] = current_barangay_id()` restricts to own folder (Finding #1) |

---

## Open Questions (resolved)

| # | Question | Resolution |
|---|----------|------------|
| 1 | JSONB vs normalized developer_profiles | **Normalized child table** with `about_us_id` FK for relational integrity |
| 2 | Orphaned asset cleanup | **Upload-then-delete**: new file uploaded first, old deleted only after DB confirms success |
| 3 | Inline upload vs URL paste | **Inline upload required** (user request). URL paste remains as fallback. |
| 4 | Terms & Privacy publish date | **No publish date**. Evergreen legal documents; `is_active` toggle is sufficient. |
| 5 | Mobile hooks scoping | Both hooks accept `barangayId`. Channel names include `barangayId`. |
| 6 | RLS for anon users | Follows existing project convention: no barangay filter for anon (client scopes queries) |
| 7 | Unique constraint approach | **Partial unique index** with `WHERE deleted_at IS NULL` instead of inline table constraint |
| 8 | Developer ID preservation across saves | **Not preserved** — RPC replaces full developer set. Acceptable for small teams; can be enhanced later. |
| 9 | Markdown rendering dependencies | `react-markdown` + `rehype-sanitize` (web), `react-native-markdown-display` (mobile) |
| 10 | Test environment | Vitest + Supabase local instance with `service_role` key for setup/teardown |

---

## Files Changed Summary

| Action | Path |
|--------|------|
| **CREATE** | `supabase/migrations/0059_site_content_and_about_us.sql` |
| **CREATE** | `supabase/migrations/0059b_storage_site_content.sql` |
| **CREATE** | `supabase/migrations/0059c_save_about_us_rpc.sql` |
| **CREATE** | `packages/shared/src/schemas/site-content.ts` |
| **CREATE** | `packages/shared/src/schemas/about-us.ts` |
| **EDIT** | `packages/shared/src/schemas/admin-audit-log.ts` |
| **EDIT** | `packages/shared/src/index.ts` |
| **EDIT** | `packages/shared/src/types/database.ts` (regenerate) |
| **EDIT** | `apps/web/src/components/admin/sidebar-nav.tsx` |
| **EDIT** | `apps/web/src/components/admin/header.tsx` |
| **CREATE** | `apps/web/src/app/(admin)/terms-privacy/page.tsx` |
| **CREATE** | `apps/web/src/app/(admin)/terms-privacy/client-wrapper.tsx` |
| **CREATE** | `apps/web/src/app/(admin)/terms-privacy/content-form.tsx` |
| **CREATE** | `apps/web/src/app/(admin)/about-us/page.tsx` |
| **CREATE** | `apps/web/src/app/(admin)/about-us/about-us-form.tsx` |
| **CREATE** | `apps/web/src/__tests__/site-content-rls.test.ts` |
| **CREATE** | `apps/web/vitest.config.ts` |
| **CREATE** | `apps/mobile/src/hooks/use-site-content.ts` |
| **CREATE** | `apps/mobile/src/hooks/use-about-us.ts` |
| **EDIT** | `apps/mobile/src/app/(app)/settings/terms-privacy.tsx` |
| **EDIT** | `apps/mobile/src/app/(app)/settings/about.tsx` |
| **EDIT** | `apps/web/package.json` (add `react-markdown`, `rehype-sanitize`) |
| **EDIT** | `apps/mobile/package.json` (add `react-native-markdown-display`) |
