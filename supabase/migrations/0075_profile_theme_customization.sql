-- Extends the 0006 App Theme columns with: (1) up to 10 admin-saved custom accent
-- swatches, and (2) a font preference. Both are personal appearance settings on the same
-- Theme page as theme_preference/accent_color — see apps/admin-web's theme-form.tsx and
-- accent-controller.tsx/font-controller.tsx (MAX_CUSTOM_COLORS in accent-controller.tsx
-- must stay in sync with the array_length check below).
alter table public.profiles
  add column custom_accent_colors text[] not null default '{}'
    check (array_length(custom_accent_colors, 1) is null or array_length(custom_accent_colors, 1) <= 10),
  add column font_preference text not null default 'system'
    check (font_preference in (
      'system', 'inter', 'arial', 'helvetica', 'segoe-ui', 'verdana',
      'tahoma', 'trebuchet-ms', 'georgia', 'times-new-roman', 'garamond', 'courier-new'
    ));
