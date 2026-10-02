-- BoiShelf schema. Apply once via Supabase CLI migrations.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (email ~* '^[^@[:space:]]+@gmail\.com$'),
  created_at timestamptz not null default now()
);
create table public.books (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title_bn text not null, title_en text not null,
  author_bn text not null, author_en text not null,
  description_bn text not null, description_en text not null,
  category text not null check (category in ('fiction','growth','lifestyle','creativity','travel')),
  price_paisa integer not null check (price_paisa between 1000 and 10000000),
  pages integer not null check (pages between 1 and 20000),
  language text not null default 'bn' check (language in ('bn','en')),
  cover_path text, cover_style text not null default 'forest',
  published boolean not null default false, is_demo boolean not null default false,
  featured boolean not null default false,
  created_at timestamptz not null default now()
);
create index books_catalogue_idx on public.books(category, created_at desc) where published;
create table public.book_formats (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  format text not null check (format in ('pdf','epub')),
  storage_path text not null unique,
  original_name text not null,
  size_bytes integer not null check (size_bytes between 1 and 31457280),
  created_at timestamptz not null default now(),
  unique(book_id,format)
);
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  book_id uuid not null references public.books(id) on delete restrict,
  book_title text not null,
  amount_paisa integer not null check (amount_paisa > 0),
  currency text not null default 'BDT' check (currency='BDT'),
  mode text not null check (mode in ('sandbox','live')),
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','review','refunded')),
  tran_id text not null unique default ('BS' || left(replace(gen_random_uuid()::text,'-',''),24)),
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index orders_user_idx on public.orders(user_id,created_at desc);
create index orders_book_idx on public.orders(book_id);
create index orders_pending_idx on public.orders(created_at) where status='pending';
create table public.payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete restrict,
  mode text not null check (mode in ('sandbox','live')),
  tran_id text not null unique,
  session_key text, gateway_url text,
  validation_id text, bank_tran_id text,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','review','refunded')),
  updated_at timestamptz not null default now(),
  unique(mode,validation_id), unique(mode,bank_tran_id)
);
create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete restrict,
  book_id uuid not null references public.books(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  mode text not null check (mode in ('sandbox','live')),
  granted_at timestamptz not null default now(), revoked_at timestamptz,
  unique(user_id,book_id,mode)
);
create index entitlements_book_idx on public.entitlements(book_id);
create index entitlements_order_idx on public.entitlements(order_id);
create table public.policies (
  slug text primary key check (slug in ('privacy','terms','refund','copyright')),
  title_bn text not null, title_en text not null,
  body_bn text not null default '', body_en text not null default '',
  published boolean not null default false,
  updated_at timestamptz not null default now(),
  check (not published or (length(trim(body_bn)) >= 30 and length(trim(body_en)) >= 30))
);
create table public.rate_limits (
  key text primary key, count integer not null, window_start timestamptz not null
);
create index rate_limits_expiry_idx on public.rate_limits(window_start);

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.book_formats enable row level security;
alter table public.orders enable row level security;
alter table public.payment_attempts enable row level security;
alter table public.entitlements enable row level security;
alter table public.policies enable row level security;
alter table public.rate_limits enable row level security;

-- Explicit grants. All writes, ebook metadata and payment internals stay server-only.
revoke all on public.profiles, public.books, public.book_formats, public.orders,
  public.payment_attempts, public.entitlements, public.policies, public.rate_limits from anon, authenticated;
grant select on public.books, public.policies to anon, authenticated;
grant select on public.profiles, public.orders, public.entitlements to authenticated;
grant all on public.profiles, public.books, public.book_formats, public.orders,
  public.payment_attempts, public.entitlements, public.policies, public.rate_limits to service_role;
create policy published_books on public.books for select to anon, authenticated using (published);
create policy published_policies on public.policies for select to anon, authenticated using (published);
create policy own_profile on public.profiles for select to authenticated using ((select auth.uid())=id);
create policy own_orders on public.orders for select to authenticated using ((select auth.uid())=user_id);
create policy own_entitlements on public.entitlements for select to authenticated using ((select auth.uid())=user_id);

-- Configure this as the Before User Created hook in Supabase Auth.
create function public.before_user_created_hook(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if coalesce(event->'user'->>'email','') !~* '^[^@[:space:]]+@gmail\.com$'
     or coalesce(event->'user'->'app_metadata'->>'provider','') <> 'google' then
    return '{"error":{"http_code":403,"message":"Only Google sign-in with a Gmail address is allowed."}}'::jsonb;
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.email ~* '^[^@[:space:]]+@gmail\.com$' then
    insert into public.profiles(id,email) values(new.id,lower(new.email));
  end if;
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;
create trigger boishelf_profile after insert on auth.users for each row execute function private.handle_new_user();

-- Service-role-only transaction functions; no SECURITY DEFINER bypass is needed.
create function public.create_order(p_user uuid,p_book uuid,p_mode text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare b public.books; o public.orders;
begin
  if p_mode not in ('sandbox','live') then raise exception 'invalid_mode'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_book::text||p_mode,0));
  if exists(select 1 from public.entitlements where user_id=p_user and book_id=p_book and mode=p_mode and revoked_at is null) then raise exception 'already_owned'; end if;
  select * into b from public.books where id=p_book and published;
  if not found or not exists(select 1 from public.book_formats where book_id=p_book) then raise exception 'book_unavailable'; end if;
  if p_mode='live' and b.is_demo then raise exception 'demo_live_forbidden'; end if;
  select * into o from public.orders where user_id=p_user and book_id=p_book and mode=p_mode and status='pending' and created_at>now()-interval '30 minutes' order by created_at desc limit 1;
  if found then return to_jsonb(o)||'{"reused":true}'::jsonb; end if;
  insert into public.orders(user_id,book_id,book_title,amount_paisa,mode)
    values(p_user,p_book,b.title_en,b.price_paisa,p_mode) returning * into o;
  insert into public.payment_attempts(order_id,mode,tran_id) values(o.id,p_mode,o.tran_id);
  return to_jsonb(o)||'{"reused":false}'::jsonb;
end;
$$;
create function public.settle_order(p_order uuid,p_mode text,p_tran text,p_amount integer,p_validation text,p_bank text,p_state text) returns void
language plpgsql security invoker set search_path='' as $$
declare o public.orders; a public.payment_attempts;
begin
  select * into o from public.orders where id=p_order for update;
  if not found then raise exception 'order_missing'; end if;
  if o.mode<>p_mode or o.tran_id<>p_tran or o.amount_paisa<>p_amount then raise exception 'payment_mismatch'; end if;
  if p_state not in ('paid','review') or coalesce(p_validation,'')='' or coalesce(p_bank,'')='' then raise exception 'invalid_validation'; end if;
  select * into a from public.payment_attempts where order_id=p_order;
  if a.validation_id is not null and (a.validation_id<>p_validation or a.bank_tran_id<>p_bank) then raise exception 'transaction_identity_mismatch'; end if;
  if o.status in ('paid','refunded') then return; end if;
  update public.payment_attempts set status=p_state,validation_id=p_validation,bank_tran_id=p_bank,updated_at=now() where order_id=p_order;
  update public.orders set status=p_state,paid_at=case when p_state='paid' then now() else null end where id=p_order;
  if p_state='paid' then
    insert into public.entitlements(user_id,book_id,order_id,mode) values(o.user_id,o.book_id,o.id,o.mode)
    on conflict(user_id,book_id,mode) do update set revoked_at=null,order_id=excluded.order_id,granted_at=now();
  end if;
end;
$$;
create function public.mark_order_unsuccessful(p_order uuid,p_state text) returns void
language plpgsql security invoker set search_path='' as $$
declare o public.orders;
begin
  if p_state not in ('failed','cancelled') then raise exception 'invalid_state'; end if;
  select * into o from public.orders where id=p_order for update;
  if o.status='pending' then
    update public.orders set status=p_state where id=p_order;
    update public.payment_attempts set status=p_state,updated_at=now() where order_id=p_order;
  end if;
end;
$$;
create function public.consume_rate_limit(p_key text,p_limit integer,p_window integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare n integer;
begin
  if p_limit<1 or p_window<1 then return false; end if;
  insert into public.rate_limits(key,count,window_start) values(p_key,1,now())
  on conflict(key) do update set
    count=case when public.rate_limits.window_start<now()-make_interval(secs=>p_window) then 1 else public.rate_limits.count+1 end,
    window_start=case when public.rate_limits.window_start<now()-make_interval(secs=>p_window) then now() else public.rate_limits.window_start end
  returning count into n;
  delete from public.rate_limits where window_start<now()-interval '1 day';
  return n<=p_limit;
end;
$$;
revoke all on function public.create_order(uuid,uuid,text),public.settle_order(uuid,text,text,integer,text,text,text),public.mark_order_unsuccessful(uuid,text),public.consume_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.create_order(uuid,uuid,text),public.settle_order(uuid,text,text,integer,text,text,text),public.mark_order_unsuccessful(uuid,text),public.consume_rate_limit(text,integer,integer) to service_role;

-- Both buckets are private. Only the server secret can upload or sign downloads.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
  ('ebooks','ebooks',false,31457280,array['application/pdf','application/epub+zip']),
  ('covers','covers',false,5242880,array['image/png','image/jpeg','image/webp'])
on conflict(id) do nothing;
