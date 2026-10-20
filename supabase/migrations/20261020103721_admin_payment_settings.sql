-- The owner edits this through the authenticated server API only.
create table public.payment_settings (
  id text primary key check (id = 'default'),
  receiving_number text check (receiving_number ~ '^01[3-9][0-9]{8}$'),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
insert into public.payment_settings (id) values ('default');
alter table public.payment_settings enable row level security;
revoke all on public.payment_settings from public, anon, authenticated;
grant select, update on public.payment_settings to service_role;
-- orders.manual_receive_number already stores the number at order creation.
-- No order or claim is rewritten when settings change.
