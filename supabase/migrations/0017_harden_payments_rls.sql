-- Drop the policy that allows residents to INSERT payments directly.
-- Payment rows are created exclusively by the create-payment-source Edge Function
-- using the service_role key after server-side amount validation.
alter table public.payments disable row level security;
drop policy if exists "residents can create a payment on their own request" on public.payments;
alter table public.payments enable row level security;
