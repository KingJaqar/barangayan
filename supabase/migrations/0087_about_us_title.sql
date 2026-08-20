-- ============================================================================
-- Add title to about_us + update RPC — migration 0087
-- ============================================================================
-- Stores a display title shown below the barangay logo on the About Us screen.
-- Defaults to "Barangayan" so existing rows are immediately valid.

alter table public.about_us
  add column title text not null default 'Barangayan';

-- Update the atomic save RPC to accept and persist title.
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
  p_sort_order     integer default 0,
  p_logo_size      integer default 64,
  p_title          text    default 'Barangayan'
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

  -- 2. Upsert about_us
  insert into public.about_us
    (barangay_id, title, mission, vision, history, contact_email, contact_phone, address,
     logo_url, logo_size, is_active, sort_order)
  values
    (p_barangay_id, p_title, p_mission, p_vision, p_history, p_contact_email, p_contact_phone, p_address,
     p_logo_url, p_logo_size, p_is_active, p_sort_order)
  on conflict (barangay_id) where deleted_at is null do update set
    title          = excluded.title,
    mission        = excluded.mission,
    vision         = excluded.vision,
    history        = excluded.history,
    contact_email  = excluded.contact_email,
    contact_phone  = excluded.contact_phone,
    address        = excluded.address,
    logo_url       = excluded.logo_url,
    logo_size      = excluded.logo_size,
    is_active      = excluded.is_active,
    sort_order     = excluded.sort_order,
    updated_at     = now()
  returning id into v_about_id;

  -- 3. Soft-delete all existing developers for this about_us
  update public.developer_profiles
    set deleted_at = now()
    where about_us_id = v_about_id
      and deleted_at is null;

  -- 4. Insert fresh developer set
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

  -- 5. Audit log
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

-- Re-grant execute on the updated function signature
grant execute on function public.save_about_us_with_developers(
  uuid, text, text, text, text, text, text, text, jsonb, boolean, integer, integer, text
) to authenticated;
