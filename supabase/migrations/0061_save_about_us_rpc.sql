-- ============================================================================
-- Atomic save RPC for About Us + developer profiles
-- ============================================================================
-- Runs the about_us upsert, developer_profiles replace-set, and audit log
-- insert in a single transaction so a mid-sequence failure can't leave
-- orphaned developer rows or a partially-updated about_us record.

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
  v_existed  boolean;
begin
  -- 1. Authorize: caller must be admin in this barangay
  if public.current_role() != 'admin' then
    raise exception 'only admins can save about_us content';
  end if;
  if p_barangay_id != public.current_barangay_id() then
    raise exception 'barangay mismatch';
  end if;

  select exists (
    select 1 from public.about_us
    where barangay_id = p_barangay_id and deleted_at is null
  ) into v_existed;

  -- 2. Upsert about_us (partial unique index on barangay_id WHERE deleted_at IS NULL)
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
    case when v_existed then 'update' else 'create' end,
    'about_us',
    v_about_id,
    'About Us page'
  );

  return v_about_id;
end;
$$;

grant execute on function public.save_about_us_with_developers(
  uuid, text, text, text, text, text, text, text, jsonb, boolean, integer
) to authenticated;
