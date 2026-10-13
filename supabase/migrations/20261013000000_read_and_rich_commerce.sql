-- Read and Rich commerce. Apply after the manual bKash migration.
-- All customer addresses and stock mutations remain service-role only.
alter table public.books drop constraint books_price_paisa_check;
alter table public.books add constraint books_price_paisa_check
  check (price_paisa=0 or price_paisa between 1000 and 10000000);
update public.books set author_en=replace(author_en,'BoiShelf','Read and Rich'),
  description_en=replace(description_en,'BoiShelf','Read and Rich'),
  author_bn=replace(author_bn,'বইশেলফ','রিড অ্যান্ড রিচ'),
  description_bn=replace(description_bn,'বইশেলফ','রিড অ্যান্ড রিচ')
  where is_demo;
create table public.print_editions (
  book_id uuid primary key references public.books(id) on delete cascade,
  price_paisa integer not null check (price_paisa between 1000 and 10000000),
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  updated_at timestamptz not null default now()
);
create table public.bundles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  kind text not null check (kind in ('ebook','physical')),
  title_bn text not null, title_en text not null,
  description_bn text not null, description_en text not null,
  price_paisa integer not null check (price_paisa between 1000 and 10000000),
  published boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now()
);
create table public.bundle_members (
  bundle_id uuid not null references public.bundles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete restrict,
  position integer not null check (position between 1 and 20),
  primary key(bundle_id,book_id), unique(bundle_id,position)
);
create table public.shipping_settings (
  id text primary key default 'default' check (id='default'),
  dhaka_paisa integer check (dhaka_paisa between 0 and 1000000),
  outside_paisa integer check (outside_paisa between 0 and 1000000),
  updated_at timestamptz not null default now()
);
insert into public.shipping_settings(id) values('default');

alter table public.orders alter column book_id drop not null;
alter table public.orders add column order_kind text not null default 'ebook'
  check (order_kind in ('ebook','ebook_bundle','physical'));
alter table public.orders add column client_key uuid unique;
alter table public.orders drop constraint orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method in ('sslcommerz','bkash_manual','cod'));
alter table public.orders add constraint orders_kind_payment_check
  check ((order_kind='physical' and payment_method in ('cod','bkash_manual'))
    or (order_kind<>'physical' and payment_method<>'cod'));
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  item_type text not null check (item_type in ('book','bundle')),
  book_id uuid references public.books(id) on delete restrict,
  bundle_id uuid references public.bundles(id) on delete restrict,
  format text not null check (format in ('ebook','physical')),
  title_bn text not null, title_en text not null,
  quantity integer not null check (quantity between 1 and 10),
  unit_price_paisa integer not null check (unit_price_paisa > 0),
  check ((item_type='book' and book_id is not null and bundle_id is null)
    or (item_type='bundle' and bundle_id is not null and book_id is null)),
  unique(order_id,book_id,bundle_id)
);
create index order_items_book_idx on public.order_items(book_id);
create index order_items_bundle_idx on public.order_items(bundle_id);
create table public.order_item_members (
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  book_id uuid not null references public.books(id) on delete restrict,
  title_bn text not null, title_en text not null,
  primary key(order_item_id,book_id)
);
create table public.order_shipping (
  order_id uuid primary key references public.orders(id) on delete restrict,
  recipient_name text not null check (length(trim(recipient_name)) between 2 and 100),
  phone text not null check (phone ~ '^01[3-9][0-9]{8}$'),
  district text not null check (length(trim(district)) between 2 and 80),
  local_area text not null check (length(trim(local_area)) between 2 and 120),
  street_address text not null check (length(trim(street_address)) between 5 and 300),
  shipping_fee_paisa integer not null check (shipping_fee_paisa >= 0),
  fulfillment_status text not null default 'placed'
    check (fulfillment_status in ('placed','shipped','delivered','cancelled','returned')),
  delivery_target date,
  courier_name text,
  tracking_number text,
  shipped_at timestamptz, delivered_at timestamptz, returned_at timestamptz,
  refund_due boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.fulfillment_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null,
  note text,
  created_at timestamptz not null default now()
);
create index fulfillment_events_order_idx on public.fulfillment_events(order_id,created_at);
create table public.inventory_events (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete restrict,
  action text not null,
  on_hand_delta integer not null default 0,
  reserved_delta integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);
create index inventory_events_book_idx on public.inventory_events(book_id,created_at);

-- Preserve existing single-ebook order history in the new item model.
insert into public.order_items(order_id,item_type,book_id,format,title_bn,title_en,quantity,unit_price_paisa)
  select o.id,'book',o.book_id,'ebook',coalesce(b.title_bn,o.book_title),o.book_title,1,o.amount_paisa
  from public.orders o left join public.books b on b.id=o.book_id where o.book_id is not null;

alter table public.print_editions enable row level security;
alter table public.bundles enable row level security;
alter table public.bundle_members enable row level security;
alter table public.shipping_settings enable row level security;
alter table public.order_items enable row level security;
alter table public.order_item_members enable row level security;
alter table public.order_shipping enable row level security;
alter table public.fulfillment_events enable row level security;
alter table public.inventory_events enable row level security;
revoke all on public.print_editions,public.bundles,public.bundle_members,
  public.shipping_settings,public.order_items,public.order_item_members,
  public.order_shipping,public.fulfillment_events,public.inventory_events
  from public,anon,authenticated;
grant all on public.print_editions,public.bundles,public.bundle_members,
  public.shipping_settings,public.order_items,public.order_item_members,
  public.order_shipping,public.fulfillment_events,public.inventory_events to service_role;
grant select on public.bundles to anon,authenticated;
create policy published_bundles on public.bundles for select to anon,authenticated
  using (published and archived_at is null);

alter table public.policies drop constraint policies_slug_check;
alter table public.policies add constraint policies_slug_check
  check (slug in ('privacy','terms','refund','copyright','shipping'));

-- Existing ebook orders still use book_id. Multi-item orders are validated in their RPCs.
create or replace function private.ensure_book_sellable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  if new.book_id is not null then
    perform 1 from public.books where id=new.book_id and published and archived_at is null for share;
    if not found then raise exception 'book_unavailable'; end if;
  end if;
  return new;
end;
$$;

-- Every item of a physical cart is priced on the server. Stock is reserved in
-- book-id order inside the same transaction, including bundle components.
create function public.create_physical_order(
  p_user uuid,p_key uuid,p_lines jsonb,p_name text,p_phone text,p_district text,
  p_area text,p_street text,p_method text,p_number text,p_expected_total integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare o public.orders; s public.shipping_settings; line jsonb; b public.books;
  bun public.bundles; item public.order_items; inv record; total integer := 0;
  fee integer; qty integer; item_id uuid; item_kind text;
begin
  if p_method not in ('cod','bkash_manual') or p_key is null or
     jsonb_typeof(p_lines)<>'array' or jsonb_array_length(p_lines) not between 1 and 20
    then raise exception 'invalid_cart'; end if;
  if p_expected_total is null or p_expected_total <= 0 then raise exception 'invalid_total'; end if;
  if p_phone !~ '^01[3-9][0-9]{8}$' then raise exception 'invalid_phone'; end if;
  if p_method='bkash_manual' and coalesce(p_number,'') !~ '^01[3-9][0-9]{8}$'
    then raise exception 'invalid_receiver'; end if;
  select * into s from public.shipping_settings where id='default';
  if s.dhaka_paisa is null or s.outside_paisa is null then raise exception 'shipping_unconfigured'; end if;
  fee := case when p_district='Dhaka' then s.dhaka_paisa else s.outside_paisa end;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_key::text||'physical_order',0));
  select * into o from public.orders where user_id=p_user and client_key=p_key for update;
  if found then return to_jsonb(o)||'{"reused":true}'::jsonb; end if;
  insert into public.orders(user_id,book_id,book_title,amount_paisa,mode,payment_method,
    manual_receive_number,order_kind,client_key,tran_id)
    values(p_user,null,'Printed books',1,'live',p_method,
      case when p_method='bkash_manual' then p_number else null end,'physical',p_key,
      'RR'||upper(left(replace(gen_random_uuid()::text,'-',''),12))) returning * into o;
  for line in select value from jsonb_array_elements(p_lines) loop
    item_kind := line->>'kind';
    if coalesce(line->>'quantity','') !~ '^[1-9][0-9]?$' or
      coalesce(line->>'id','') !~ '^[0-9a-f-]{36}$' then raise exception 'invalid_cart'; end if;
    qty := (line->>'quantity')::integer;
    if qty > 10 or item_kind not in ('book','bundle') then raise exception 'invalid_cart'; end if;
    item_id := (line->>'id')::uuid;
    if exists(select 1 from public.order_items where order_id=o.id and
      ((item_kind='book' and book_id=item_id) or (item_kind='bundle' and bundle_id=item_id)))
      then raise exception 'duplicate_item'; end if;
    if item_kind='book' then
      select * into b from public.books where id=item_id and published and archived_at is null and not is_demo;
      if not found then raise exception 'book_unavailable'; end if;
      insert into public.order_items(order_id,item_type,book_id,format,title_bn,title_en,quantity,unit_price_paisa)
        select o.id,'book',b.id,'physical',b.title_bn,b.title_en,qty,pe.price_paisa
        from public.print_editions pe where pe.book_id=b.id returning * into item;
      if not found then raise exception 'book_unavailable'; end if;
    else
      select * into bun from public.bundles where id=item_id and kind='physical' and published and archived_at is null;
      if not found then raise exception 'bundle_unavailable'; end if;
      insert into public.order_items(order_id,item_type,bundle_id,format,title_bn,title_en,quantity,unit_price_paisa)
        values(o.id,'bundle',bun.id,'physical',bun.title_bn,bun.title_en,qty,bun.price_paisa) returning * into item;
      insert into public.order_item_members(order_item_id,book_id,title_bn,title_en)
        select item.id,b.id,b.title_bn,b.title_en from public.bundle_members bm
        join public.books b on b.id=bm.book_id
        join public.print_editions pe on pe.book_id=b.id
        where bm.bundle_id=bun.id and b.published and b.archived_at is null and not b.is_demo;
      if (select count(*) from public.order_item_members where order_item_id=item.id)<2 or
         (select count(*) from public.order_item_members where order_item_id=item.id)<>
         (select count(*) from public.bundle_members where bundle_id=bun.id)
        then raise exception 'bundle_unavailable'; end if;
    end if;
    total := total + qty*item.unit_price_paisa;
  end loop;
  -- Use row locks to serialize purchases of the last available copies.
  for inv in
    with parts as (
      select oi.book_id,oi.quantity as qty from public.order_items oi
        where oi.order_id=o.id and oi.item_type='book'
      union all
      select m.book_id,oi.quantity from public.order_items oi
        join public.order_item_members m on m.order_item_id=oi.id
        where oi.order_id=o.id and oi.item_type='bundle'
    ) select book_id,sum(qty)::integer as qty from parts group by book_id order by book_id
  loop
    update public.print_editions set reserved=reserved+inv.qty,updated_at=now()
      where book_id=inv.book_id and on_hand-reserved>=inv.qty;
    if not found then raise exception 'out_of_stock'; end if;
    insert into public.inventory_events(book_id,order_id,action,reserved_delta)
      values(inv.book_id,o.id,'reserve',inv.qty);
  end loop;
  if p_expected_total<>total+fee then raise exception 'price_changed'; end if;
  update public.orders set amount_paisa=total+fee where id=o.id returning * into o;
  insert into public.order_shipping(order_id,recipient_name,phone,district,local_area,street_address,shipping_fee_paisa)
    values(o.id,trim(p_name),p_phone,p_district,trim(p_area),trim(p_street),fee);
  insert into public.fulfillment_events(order_id,action) values(o.id,'placed');
  return to_jsonb(o)||'{"reused":false}'::jsonb;
end;
$$;

create function public.create_ebook_bundle_order(p_user uuid,p_bundle uuid,p_number text)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare bun public.bundles; o public.orders; item public.order_items; member record;
begin
  if p_number !~ '^01[3-9][0-9]{8}$' then raise exception 'invalid_receiver'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_bundle::text||'ebook_bundle',0));
  select * into bun from public.bundles where id=p_bundle and kind='ebook' and published and archived_at is null;
  if not found then raise exception 'bundle_unavailable'; end if;
  if (select count(*) from public.bundle_members where bundle_id=bun.id)<2 then raise exception 'bundle_unavailable'; end if;
  for member in select b.id from public.bundle_members bm join public.books b on b.id=bm.book_id
    where bm.bundle_id=bun.id
  loop
    if not exists(select 1 from public.books b where b.id=member.id and b.published and b.archived_at is null and not b.is_demo)
      or not exists(select 1 from public.book_formats where book_id=member.id)
      then raise exception 'bundle_unavailable'; end if;
    if exists(select 1 from public.entitlements where user_id=p_user and book_id=member.id
      and mode='live' and revoked_at is null) then raise exception 'already_owned'; end if;
  end loop;
  select o.* into o from public.orders o join public.order_items oi on oi.order_id=o.id
    where o.user_id=p_user and o.order_kind='ebook_bundle' and oi.bundle_id=p_bundle
      and o.status in ('pending','review','rejected') order by o.created_at desc limit 1;
  if found then return to_jsonb(o)||'{"reused":true}'::jsonb; end if;
  insert into public.orders(user_id,book_id,book_title,amount_paisa,mode,payment_method,
    manual_receive_number,order_kind,tran_id)
    values(p_user,null,bun.title_en,bun.price_paisa,'live','bkash_manual',p_number,
      'ebook_bundle','RR'||upper(left(replace(gen_random_uuid()::text,'-',''),12))) returning * into o;
  insert into public.order_items(order_id,item_type,bundle_id,format,title_bn,title_en,quantity,unit_price_paisa)
    values(o.id,'bundle',bun.id,'ebook',bun.title_bn,bun.title_en,1,bun.price_paisa) returning * into item;
  insert into public.order_item_members(order_item_id,book_id,title_bn,title_en)
    select item.id,b.id,b.title_bn,b.title_en from public.bundle_members bm
    join public.books b on b.id=bm.book_id where bm.bundle_id=bun.id;
  return to_jsonb(o)||'{"reused":false}'::jsonb;
end;
$$;

create or replace function public.approve_manual_claim(p_order uuid,p_claim uuid,p_owner uuid)
returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; c public.manual_payment_claims; member record;
begin
  select * into o from public.orders where id=p_order for update;
  if not found or o.payment_method<>'bkash_manual' or o.mode<>'live'
    then raise exception 'order_missing'; end if;
  select * into c from public.manual_payment_claims where id=p_claim and order_id=p_order for update;
  if not found then raise exception 'claim_missing'; end if;
  if o.status='paid' and c.status='approved' then return; end if;
  if o.status<>'review' or c.status<>'submitted' then raise exception 'claim_not_pending'; end if;
  if o.order_kind='ebook' and exists(select 1 from public.entitlements where user_id=o.user_id
    and book_id=o.book_id and mode='live' and revoked_at is null) then raise exception 'already_owned'; end if;
  if o.order_kind='ebook_bundle' and exists(
    select 1 from public.order_items oi join public.order_item_members m on m.order_item_id=oi.id
    join public.entitlements e on e.book_id=m.book_id and e.user_id=o.user_id
      and e.mode='live' and e.revoked_at is null where oi.order_id=o.id
  ) then raise exception 'already_owned'; end if;
  update public.manual_payment_claims set status='approved',decided_at=now(),decided_by=p_owner where id=p_claim;
  update public.orders set status='paid',paid_at=now() where id=p_order;
  if o.order_kind='ebook' then
    insert into public.entitlements(user_id,book_id,order_id,mode) values(o.user_id,o.book_id,o.id,'live')
      on conflict(user_id,book_id,mode) do update set revoked_at=null,order_id=excluded.order_id,granted_at=now();
  elsif o.order_kind='ebook_bundle' then
    for member in select m.book_id from public.order_items oi join public.order_item_members m on m.order_item_id=oi.id
      where oi.order_id=o.id loop
      insert into public.entitlements(user_id,book_id,order_id,mode) values(o.user_id,member.book_id,o.id,'live')
        on conflict(user_id,book_id,mode) do update set revoked_at=null,order_id=excluded.order_id,granted_at=now();
    end loop;
  end if;
end;
$$;

create function public.change_physical_order(
  p_order uuid,p_actor uuid,p_action text,p_target date default null,
  p_courier text default null,p_tracking text default null,p_note text default null
) returns void language plpgsql security invoker set search_path='' as $$
declare o public.orders; ship public.order_shipping; inv record;
begin
  select * into o from public.orders where id=p_order and order_kind='physical' for update;
  if not found then raise exception 'order_missing'; end if;
  select * into ship from public.order_shipping where order_id=p_order for update;
  if p_action='target' then
    if ship.fulfillment_status not in ('placed','shipped') or p_target<current_date or p_target is null
      then raise exception 'invalid_transition'; end if;
    update public.order_shipping set delivery_target=p_target,updated_at=now() where order_id=p_order;
  elsif p_action='ship' then
    if ship.fulfillment_status<>'placed' or ship.delivery_target is null or
      (o.payment_method='bkash_manual' and o.status<>'paid') or
      length(trim(coalesce(p_courier,'')))<2 or length(trim(coalesce(p_tracking,'')))<2
      then raise exception 'invalid_transition'; end if;
    for inv in
      with parts as (
        select oi.book_id,oi.quantity as qty from public.order_items oi where oi.order_id=p_order and oi.item_type='book'
        union all
        select m.book_id,oi.quantity from public.order_items oi join public.order_item_members m on m.order_item_id=oi.id
          where oi.order_id=p_order and oi.item_type='bundle'
      ) select book_id,sum(qty)::integer as qty from parts group by book_id order by book_id
    loop
      update public.print_editions set on_hand=on_hand-inv.qty,reserved=reserved-inv.qty,updated_at=now()
        where book_id=inv.book_id and reserved>=inv.qty;
      if not found then raise exception 'stock_mismatch'; end if;
      insert into public.inventory_events(book_id,order_id,actor_id,action,on_hand_delta,reserved_delta)
        values(inv.book_id,p_order,p_actor,'shipped',-inv.qty,-inv.qty);
    end loop;
    update public.order_shipping set fulfillment_status='shipped',courier_name=trim(p_courier),
      tracking_number=trim(p_tracking),shipped_at=now(),updated_at=now() where order_id=p_order;
  elsif p_action='deliver' then
    if ship.fulfillment_status<>'shipped' then raise exception 'invalid_transition'; end if;
    update public.order_shipping set fulfillment_status='delivered',delivered_at=now(),updated_at=now() where order_id=p_order;
  elsif p_action='collect' then
    if o.payment_method<>'cod' or ship.fulfillment_status<>'delivered' or o.status='paid'
      then raise exception 'invalid_transition'; end if;
    update public.orders set status='paid',paid_at=now() where id=p_order;
  elsif p_action in ('cancel','cancel_paid') then
    if ship.fulfillment_status<>'placed' or
      (p_action='cancel' and o.status not in ('pending','rejected')) or
      (p_action='cancel_paid' and o.status<>'paid') then raise exception 'invalid_transition'; end if;
    for inv in
      with parts as (
        select oi.book_id,oi.quantity as qty from public.order_items oi where oi.order_id=p_order and oi.item_type='book'
        union all
        select m.book_id,oi.quantity from public.order_items oi join public.order_item_members m on m.order_item_id=oi.id
          where oi.order_id=p_order and oi.item_type='bundle'
      ) select book_id,sum(qty)::integer as qty from parts group by book_id order by book_id
    loop
      update public.print_editions set reserved=reserved-inv.qty,updated_at=now()
        where book_id=inv.book_id and reserved>=inv.qty;
      if not found then raise exception 'stock_mismatch'; end if;
      insert into public.inventory_events(book_id,order_id,actor_id,action,reserved_delta)
        values(inv.book_id,p_order,p_actor,'cancelled',-inv.qty);
    end loop;
    update public.order_shipping set fulfillment_status='cancelled',refund_due=(p_action='cancel_paid'),updated_at=now()
      where order_id=p_order;
    if p_action='cancel' then update public.orders set status='cancelled' where id=p_order; end if;
  elsif p_action='return' then
    if ship.fulfillment_status not in ('shipped','delivered') then raise exception 'invalid_transition'; end if;
    update public.order_shipping set fulfillment_status='returned',returned_at=now(),
      refund_due=(o.status='paid'),updated_at=now() where order_id=p_order;
    if o.status<>'paid' then update public.orders set status='cancelled' where id=p_order; end if;
  elsif p_action='refund' then
    if not ship.refund_due or o.status<>'paid' then raise exception 'invalid_transition'; end if;
    update public.order_shipping set refund_due=false,updated_at=now() where order_id=p_order;
    update public.orders set status='refunded' where id=p_order;
  else raise exception 'invalid_action'; end if;
  insert into public.fulfillment_events(order_id,actor_id,action,note)
    values(p_order,p_actor,p_action,nullif(trim(p_note),''));
end;
$$;

create function public.adjust_print_stock(p_book uuid,p_actor uuid,p_on_hand integer,p_note text)
returns void language plpgsql security invoker set search_path='' as $$
declare old_stock public.print_editions;
begin
  if length(trim(coalesce(p_note,'')))<3 then raise exception 'reason_required'; end if;
  select * into old_stock from public.print_editions where book_id=p_book for update;
  if not found then raise exception 'edition_missing'; end if;
  if p_on_hand<old_stock.reserved then raise exception 'below_reserved'; end if;
  update public.print_editions set on_hand=p_on_hand,updated_at=now() where book_id=p_book;
  insert into public.inventory_events(book_id,actor_id,action,on_hand_delta,note)
    values(p_book,p_actor,'adjustment',p_on_hand-old_stock.on_hand,trim(p_note));
end;
$$;

create function public.save_print_edition(
  p_book uuid,p_actor uuid,p_price integer,p_on_hand integer,p_note text
) returns void language plpgsql security invoker set search_path='' as $$
declare old_stock public.print_editions;
begin
  if p_price not between 1000 and 10000000 or p_on_hand<0 or
     length(trim(coalesce(p_note,'')))<3 then raise exception 'invalid_edition'; end if;
  perform 1 from public.books where id=p_book and archived_at is null for update;
  if not found then raise exception 'book_unavailable'; end if;
  select * into old_stock from public.print_editions where book_id=p_book for update;
  if found and p_on_hand<old_stock.reserved then raise exception 'below_reserved'; end if;
  insert into public.print_editions(book_id,price_paisa,on_hand)
    values(p_book,p_price,p_on_hand)
    on conflict(book_id) do update set price_paisa=excluded.price_paisa,
      on_hand=excluded.on_hand,updated_at=now();
  insert into public.inventory_events(book_id,actor_id,action,on_hand_delta,note)
    values(p_book,p_actor,'adjustment',p_on_hand-coalesce(old_stock.on_hand,0),trim(p_note));
end;
$$;

create function public.save_bundle(
  p_id uuid,p_slug text,p_kind text,p_title_bn text,p_title_en text,
  p_description_bn text,p_description_en text,p_price integer,p_published boolean,p_members uuid[]
) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid; member_id uuid; position integer := 0;
begin
  if p_kind not in ('ebook','physical') or p_members is null or
    coalesce(array_length(p_members,1),0) not between 2 and 10
    or (select count(distinct x) from unnest(p_members) x)<>array_length(p_members,1)
    then raise exception 'invalid_bundle'; end if;
  if p_published and exists(
    select 1 from unnest(p_members) x join public.books b on b.id=x
    where not b.published or b.archived_at is not null or b.is_demo
  ) then raise exception 'bundle_unavailable'; end if;
  if (select count(*) from public.books where id=any(p_members))<>array_length(p_members,1)
    then raise exception 'book_unavailable'; end if;
  if p_published and p_kind='ebook' and exists(
    select 1 from unnest(p_members) x where not exists(
      select 1 from public.book_formats where book_id=x)
  ) then raise exception 'bundle_unavailable'; end if;
  if p_published and p_kind='physical' and exists(
    select 1 from unnest(p_members) x where not exists(
      select 1 from public.print_editions where book_id=x)
  ) then raise exception 'bundle_unavailable'; end if;
  if p_id is null then
    insert into public.bundles(slug,kind,title_bn,title_en,description_bn,description_en,price_paisa,published)
      values(p_slug,p_kind,p_title_bn,p_title_en,p_description_bn,p_description_en,p_price,p_published)
      returning id into result_id;
  else
    update public.bundles set slug=p_slug,kind=p_kind,title_bn=p_title_bn,title_en=p_title_en,
      description_bn=p_description_bn,description_en=p_description_en,price_paisa=p_price,
      published=p_published where id=p_id and archived_at is null returning id into result_id;
    if result_id is null then raise exception 'bundle_missing'; end if;
    delete from public.bundle_members where bundle_id=result_id;
  end if;
  foreach member_id in array p_members loop
    position := position+1;
    insert into public.bundle_members(bundle_id,book_id,position)
      values(result_id,member_id,position);
  end loop;
  return result_id;
end;
$$;

-- A printed-only book can be deleted while unsold even after stock adjustments.
-- Purchased components stay protected by order_items/order_item_members FKs.
create or replace function public.delete_unsold_book(p_book uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare b public.books;
begin
  select * into b from public.books where id=p_book for update;
  if not found then raise exception 'book_not_found'; end if;
  if exists(select 1 from public.orders where book_id=p_book) or
     exists(select 1 from public.order_items where book_id=p_book) or
     exists(select 1 from public.order_item_members where book_id=p_book) then
    raise exception 'book_has_orders';
  end if;
  insert into public.storage_cleanup_jobs(book_id,bucket,object_path)
    select p_book,'covers',b.cover_path where b.cover_path is not null
    union select p_book,'ebooks',storage_path from public.book_formats where book_id=p_book
    union select p_book,'ebooks',source_path from public.book_previews
      where book_id=p_book and source_kind='sample_pdf'
    union select p_book,'ebooks',preview_path from public.book_previews
      where book_id=p_book and preview_path is not null
    union select p_book,bucket_id,name from storage.objects
      where bucket_id in ('ebooks','covers') and left(name,length(p_book::text)+1)=p_book::text||'/'
  on conflict(bucket,object_path) do nothing;
  delete from public.inventory_events where book_id=p_book and order_id is null;
  delete from public.book_previews where book_id=p_book;
  delete from public.book_formats where book_id=p_book;
  delete from public.books where id=p_book;
  return true;
end;
$$;

revoke all on function public.create_physical_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,integer),
  public.create_ebook_bundle_order(uuid,uuid,text),
  public.change_physical_order(uuid,uuid,text,date,text,text,text),
  public.adjust_print_stock(uuid,uuid,integer,text),
  public.save_print_edition(uuid,uuid,integer,integer,text),
  public.save_bundle(uuid,text,text,text,text,text,text,integer,boolean,uuid[])
  from public,anon,authenticated;
grant execute on function public.create_physical_order(uuid,uuid,jsonb,text,text,text,text,text,text,text,integer),
  public.create_ebook_bundle_order(uuid,uuid,text),
  public.change_physical_order(uuid,uuid,text,date,text,text,text),
  public.adjust_print_stock(uuid,uuid,integer,text),
  public.save_print_edition(uuid,uuid,integer,integer,text),
  public.save_bundle(uuid,text,text,text,text,text,text,integer,boolean,uuid[])
  to service_role;
