-- Manual bKash claims are never proof of payment. Only an owner-reviewed
-- service-role transaction can grant a live entitlement.
alter table public.orders add column payment_method text not null default 'sslcommerz'
  check (payment_method in ('sslcommerz','bkash_manual'));
alter table public.orders add column manual_receive_number text
  check (manual_receive_number is null or manual_receive_number ~ '^01[3-9][0-9]{8}$');
alter table public.orders drop constraint orders_status_check;
alter table public.orders add constraint orders_status_check
  check (status in ('pending','paid','failed','cancelled','review','refunded','rejected'));

create table public.manual_payment_claims (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  transaction_id text not null check (transaction_id ~ '^[A-Z0-9]{6,30}$'),
  sender_last4 text check (sender_last4 ~ '^[0-9]{4}$'),
  status text not null default 'submitted' check (status in ('submitted','approved','rejected')),
  rejection_reason text,
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete restrict,
  check ((status='submitted' and decided_at is null and decided_by is null)
    or (status<>'submitted' and decided_at is not null and decided_by is not null))
);
-- A transaction ID belongs to only one order, even after a rejected claim.
-- The same buyer may correct that order's sender details without losing history.
create table public.manual_payment_references (
  transaction_id text primary key check (transaction_id ~ '^[A-Z0-9]{6,30}$'),
  order_id uuid not null references public.orders(id) on delete restrict,
  reserved_at timestamptz not null default now()
);
create index manual_payment_references_order_idx on public.manual_payment_references(order_id);
create unique index manual_claim_one_active_per_order on public.manual_payment_claims(order_id)
  where status='submitted';
create index manual_claims_order_idx on public.manual_payment_claims(order_id,submitted_at desc);
create index manual_claims_queue_idx on public.manual_payment_claims(submitted_at)
  where status='submitted';
alter table public.manual_payment_claims enable row level security;
alter table public.manual_payment_references enable row level security;
revoke all on public.manual_payment_claims from public,anon,authenticated;
revoke all on public.manual_payment_references from public,anon,authenticated;
grant all on public.manual_payment_claims to service_role;
grant all on public.manual_payment_references to service_role;

create function public.create_manual_order(p_user uuid,p_book uuid,p_number text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare b public.books; o public.orders;
begin
  if p_number !~ '^01[3-9][0-9]{8}$' then raise exception 'invalid_receiver'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_book::text||'manual',0));
  if exists(select 1 from public.entitlements where user_id=p_user and book_id=p_book
    and mode='live' and revoked_at is null) then raise exception 'already_owned'; end if;
  select * into b from public.books where id=p_book and published and archived_at is null;
  if not found or b.is_demo or not exists(select 1 from public.book_formats where book_id=p_book)
    then raise exception 'book_unavailable'; end if;
  select * into o from public.orders where user_id=p_user and book_id=p_book
    and payment_method='bkash_manual' and status in ('pending','review','rejected')
    order by created_at desc limit 1;
  if found then return to_jsonb(o)||'{"reused":true}'::jsonb; end if;
  insert into public.orders(user_id,book_id,book_title,amount_paisa,mode,payment_method,tran_id,manual_receive_number)
    values(p_user,p_book,b.title_en,b.price_paisa,'live','bkash_manual',
      'BS'||upper(left(replace(gen_random_uuid()::text,'-',''),12)),p_number) returning * into o;
  return to_jsonb(o)||'{"reused":false}'::jsonb;
end;
$$;

create function public.submit_manual_claim(p_user uuid,p_order uuid,p_transaction text,p_last4 text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; v_transaction text;
begin
  v_transaction := upper(trim(p_transaction));
  if v_transaction !~ '^[A-Z0-9]{6,30}$' then raise exception 'invalid_transaction'; end if;
  if p_last4 is not null and p_last4 !~ '^[0-9]{4}$' then raise exception 'invalid_sender'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.user_id<>p_user then raise exception 'order_missing'; end if;
  if o.payment_method<>'bkash_manual' or o.mode<>'live'
    or o.status not in ('pending','rejected') then raise exception 'claim_not_allowed'; end if;
  insert into public.manual_payment_references(transaction_id,order_id)
    values(v_transaction,p_order) on conflict(transaction_id) do nothing;
  if not exists(select 1 from public.manual_payment_references
    where transaction_id=v_transaction and order_id=p_order)
    then raise exception 'transaction_reused'; end if;
  insert into public.manual_payment_claims(order_id,transaction_id,sender_last4)
    values(p_order,v_transaction,p_last4);
  update public.orders set status='review' where id=p_order;
end;
$$;

create function public.approve_manual_claim(p_order uuid,p_claim uuid,p_owner uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; c public.manual_payment_claims;
begin
  select * into o from public.orders where id=p_order for update;
  if not found or o.payment_method<>'bkash_manual' or o.mode<>'live'
    then raise exception 'order_missing'; end if;
  select * into c from public.manual_payment_claims where id=p_claim and order_id=p_order for update;
  if not found then raise exception 'claim_missing'; end if;
  if o.status='paid' and c.status='approved' then return; end if;
  if o.status<>'review' or c.status<>'submitted' then raise exception 'claim_not_pending'; end if;
  if exists(select 1 from public.entitlements where user_id=o.user_id and book_id=o.book_id
    and mode='live' and revoked_at is null) then raise exception 'already_owned'; end if;
  update public.manual_payment_claims set status='approved',decided_at=now(),decided_by=p_owner
    where id=p_claim;
  update public.orders set status='paid',paid_at=now() where id=p_order;
  insert into public.entitlements(user_id,book_id,order_id,mode)
    values(o.user_id,o.book_id,o.id,'live')
    on conflict(user_id,book_id,mode) do update set revoked_at=null,
      order_id=excluded.order_id,granted_at=now();
end;
$$;

create function public.reject_manual_claim(p_order uuid,p_claim uuid,p_owner uuid,p_reason text)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; c public.manual_payment_claims;
begin
  if length(trim(coalesce(p_reason,''))) not between 5 and 300
    then raise exception 'invalid_reason'; end if;
  select * into o from public.orders where id=p_order for update;
  if not found or o.payment_method<>'bkash_manual' or o.mode<>'live'
    then raise exception 'order_missing'; end if;
  select * into c from public.manual_payment_claims where id=p_claim and order_id=p_order for update;
  if not found then raise exception 'claim_missing'; end if;
  if o.status='rejected' and c.status='rejected' then return; end if;
  if o.status<>'review' or c.status<>'submitted' then raise exception 'claim_not_pending'; end if;
  update public.manual_payment_claims set status='rejected',rejection_reason=trim(p_reason),
    decided_at=now(),decided_by=p_owner where id=p_claim;
  update public.orders set status='rejected' where id=p_order;
end;
$$;

revoke all on function public.create_manual_order(uuid,uuid,text),
  public.submit_manual_claim(uuid,uuid,text,text),
  public.approve_manual_claim(uuid,uuid,uuid),
  public.reject_manual_claim(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.create_manual_order(uuid,uuid,text),
  public.submit_manual_claim(uuid,uuid,text,text),
  public.approve_manual_claim(uuid,uuid,uuid),
  public.reject_manual_claim(uuid,uuid,uuid,text) to service_role;
