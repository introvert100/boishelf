-- District-specific delivery; retain legacy fees and all order snapshots.
create table public.delivery_districts (
  district text primary key check (district in ('Bagerhat', 'Bandarban', 'Barguna', 'Barishal', 'Bhola', 'Bogura', 'Brahmanbaria', 'Chandpur', 'Chapainawabganj', 'Chattogram', 'Chuadanga', 'Cox''s Bazar', 'Cumilla', 'Dhaka', 'Dinajpur', 'Faridpur', 'Feni', 'Gaibandha', 'Gazipur', 'Gopalganj', 'Habiganj', 'Jamalpur', 'Jashore', 'Jhalokati', 'Jhenaidah', 'Joypurhat', 'Khagrachhari', 'Khulna', 'Kishoreganj', 'Kurigram', 'Kushtia', 'Lakshmipur', 'Lalmonirhat', 'Madaripur', 'Magura', 'Manikganj', 'Meherpur', 'Moulvibazar', 'Munshiganj', 'Mymensingh', 'Naogaon', 'Narail', 'Narayanganj', 'Narsingdi', 'Natore', 'Netrokona', 'Nilphamari', 'Noakhali', 'Pabna', 'Panchagarh', 'Patuakhali', 'Pirojpur', 'Rajbari', 'Rajshahi', 'Rangamati', 'Rangpur', 'Satkhira', 'Shariatpur', 'Sherpur', 'Sirajganj', 'Sunamganj', 'Sylhet', 'Tangail', 'Thakurgaon')),
  fee_paisa integer not null check (fee_paisa between 0 and 1000000),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);
alter table public.delivery_districts enable row level security;
revoke all on public.delivery_districts from public,anon,authenticated;
grant select,insert,update,delete on public.delivery_districts to service_role;
-- Dhaka only. Preserve the owner's existing fee; 50 BDT for a fresh setup.
insert into public.delivery_districts(district,fee_paisa)
select 'Dhaka',coalesce(dhaka_paisa,5000) from public.shipping_settings where id='default';

alter table public.payment_settings
  add column bkash_enabled boolean not null default true,
  add column cod_enabled boolean not null default true,
  add column business_confirmed boolean,
  add column courier_confirmed boolean;
-- The owner requested both switches ON. Existing business/courier environment
-- attestations bootstrap null values; all policy, number, stock and auth gates remain.
-- A saved false confirmation overrides environment configuration.

create function public.save_delivery_districts(p_districts jsonb,p_owner uuid)
returns void language plpgsql security invoker set search_path='' as $$
begin
  if p_districts is null or jsonb_typeof(p_districts)<>'array' then
    raise exception 'invalid_districts';
  end if;
  if jsonb_array_length(p_districts)>64 or p_owner is null then raise exception 'invalid_districts'; end if;
  if exists(select 1 from jsonb_array_elements(p_districts) d
    where jsonb_typeof(d)<>'object' or coalesce(jsonb_typeof(d->'district'),'')<>'string'
      or coalesce(jsonb_typeof(d->'fee_paisa'),'')<>'number'
      or coalesce(d->>'fee_paisa','') !~ '^[0-9]{1,7}$') then raise exception 'invalid_districts'; end if;
  -- Serialize the complete replacement with new orders. Any failure rolls back
  -- both deletions and inserts, keeping the previous working fee list.
  perform 1 from public.shipping_settings where id='default' for update;
  if not found then raise exception 'shipping_unconfigured'; end if;
  delete from public.delivery_districts;
  insert into public.delivery_districts(district,fee_paisa,updated_by)
    select d->>'district',(d->>'fee_paisa')::integer,p_owner from jsonb_array_elements(p_districts) d;
end;
$$;
revoke all on function public.save_delivery_districts(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.save_delivery_districts(jsonb,uuid) to service_role;

create or replace function public.create_physical_order(
  p_user uuid,p_key uuid,p_lines jsonb,p_name text,p_phone text,p_district text,
  p_area text,p_street text,p_method text,p_number text,p_expected_total integer
) returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare o public.orders; line jsonb; b public.books;
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
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_key::text||'physical_order',0));
  select * into o from public.orders where user_id=p_user and client_key=p_key for update;
  if found then return to_jsonb(o)||'{"reused":true}'::jsonb; end if;
  perform 1 from public.shipping_settings where id='default' for share;
  if not found then raise exception 'shipping_unconfigured'; end if;
  select fee_paisa into fee from public.delivery_districts where district=p_district;
  if not found then raise exception 'district_unavailable'; end if;
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
      select * into b from public.books where id=item_id and published and archived_at is null and not is_demo for share;
      if not found then raise exception 'book_unavailable'; end if;
      insert into public.order_items(order_id,item_type,book_id,format,title_bn,title_en,quantity,unit_price_paisa)
        select o.id,'book',b.id,'physical',b.title_bn,b.title_en,qty,pe.price_paisa
        from public.print_editions pe where pe.book_id=b.id returning * into item;
      if not found then raise exception 'book_unavailable'; end if;
    else
      select * into bun from public.bundles where id=item_id and kind='physical' and published and archived_at is null for share;
      if not found then raise exception 'bundle_unavailable'; end if;
      insert into public.order_items(order_id,item_type,bundle_id,format,title_bn,title_en,quantity,unit_price_paisa)
        values(o.id,'bundle',bun.id,bun.kind,bun.title_bn,bun.title_en,qty,bun.price_paisa) returning * into item;
      insert into public.order_item_members(order_item_id,book_id,title_bn,title_en,format)
        select item.id,b.id,b.title_bn,b.title_en,bm.format from public.bundle_members bm
        join public.books b on b.id=bm.book_id
        where bm.bundle_id=bun.id and b.published and b.archived_at is null and not b.is_demo
          and ((bm.format='physical' and exists(select 1 from public.print_editions pe where pe.book_id=b.id))
            or (bm.format='ebook' and exists(select 1 from public.book_formats bf where bf.book_id=b.id)));
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
        where oi.order_id=o.id and oi.item_type='bundle' and m.format='physical'
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

