-- Mixed bundles: immutable per-order edition snapshots; no new public access.
-- Apply this migration before deploying the application that reads member formats.
begin;
alter table public.bundles drop constraint bundles_kind_check;
alter table public.bundles add constraint bundles_kind_check check (kind in ('ebook','physical','mixed'));
alter table public.order_items drop constraint order_items_format_check;
alter table public.order_items add constraint order_items_format_check check (format in ('ebook','physical','mixed'));

alter table public.bundle_members add column format text;
update public.bundle_members m set format=b.kind from public.bundles b where b.id=m.bundle_id;
alter table public.bundle_members alter column format set not null;
alter table public.bundle_members add constraint bundle_members_format_check check (format in ('ebook','physical'));
alter table public.order_item_members add column format text;
update public.order_item_members m set format=i.format from public.order_items i where i.id=m.order_item_id;
alter table public.order_item_members alter column format set not null;
alter table public.order_item_members add constraint order_item_members_format_check check (format in ('ebook','physical'));

create function private.grant_order_ebooks(p_order uuid) returns void
language sql security invoker set search_path='' as $$
  insert into public.entitlements(user_id,book_id,order_id,mode)
    select distinct o.user_id,m.book_id,o.id,'live' from public.orders o
    join public.order_items i on i.order_id=o.id
    join public.order_item_members m on m.order_item_id=i.id
    where o.id=p_order and o.status='paid' and o.mode='live' and m.format='ebook'
    on conflict(user_id,book_id,mode) do update set revoked_at=null,
      order_id=excluded.order_id,granted_at=now()
      where public.entitlements.revoked_at is not null;
$$;
revoke all on function private.grant_order_ebooks(uuid) from public,anon,authenticated;
grant execute on function private.grant_order_ebooks(uuid) to service_role;

create function public.save_bundle_v2(
  p_id uuid,p_slug text,p_kind text,p_title_bn text,p_title_en text,
  p_description_bn text,p_description_en text,p_price integer,p_published boolean,p_members jsonb
) returns uuid language plpgsql security invoker set search_path='' as $$
declare result_id uuid; member jsonb; member_id uuid; member_format text;
  position integer := 0; b public.books;
begin
  if p_kind not in ('ebook','physical','mixed') or p_kind is null or p_members is null or
    jsonb_typeof(p_members)<>'array' or jsonb_array_length(p_members) not between 2 and 10
    then raise exception 'invalid_bundle'; end if;
  if (select count(distinct (x->>'bookId')::uuid) from jsonb_array_elements(p_members) x)<>jsonb_array_length(p_members)
    then raise exception 'invalid_bundle'; end if;
  if p_kind='mixed' and (not exists(select 1 from jsonb_array_elements(p_members) x where x->>'format'='ebook')
    or not exists(select 1 from jsonb_array_elements(p_members) x where x->>'format'='physical'))
    then raise exception 'invalid_bundle'; end if;
  for member in select value from jsonb_array_elements(p_members) loop
    member_id := (member->>'bookId')::uuid; member_format := member->>'format';
    if member_format is null or member_format not in ('ebook','physical') or
      (p_kind<>'mixed' and member_format<>p_kind) then raise exception 'invalid_bundle'; end if;
    select * into b from public.books where id=member_id for share;
    if not found then raise exception 'book_unavailable'; end if;
    if p_published and (not b.published or b.is_demo or b.archived_at is not null or
      (member_format='ebook' and not exists(select 1 from public.book_formats where book_id=b.id)) or
      (member_format='physical' and not exists(select 1 from public.print_editions where book_id=b.id)))
      then raise exception 'bundle_unavailable'; end if;
  end loop;
  if p_id is null then
    insert into public.bundles(slug,kind,title_bn,title_en,description_bn,description_en,price_paisa,published)
      values(p_slug,p_kind,p_title_bn,p_title_en,p_description_bn,p_description_en,p_price,p_published)
      returning id into result_id;
  else
    update public.bundles set slug=p_slug,kind=p_kind,title_bn=p_title_bn,title_en=p_title_en,
      description_bn=p_description_bn,description_en=p_description_en,price_paisa=p_price,published=p_published
      where id=p_id and archived_at is null returning id into result_id;
    if result_id is null then raise exception 'bundle_missing'; end if;
    delete from public.bundle_members where bundle_id=result_id;
  end if;
  for member in select value from jsonb_array_elements(p_members) loop
    position := position+1;
    insert into public.bundle_members(bundle_id,book_id,position,format)
      values(result_id,(member->>'bookId')::uuid,position,member->>'format');
  end loop;
  return result_id;
end;
$$;
-- Retain the old signature for rollback and existing single-format callers.
create or replace function public.save_bundle(
  p_id uuid,p_slug text,p_kind text,p_title_bn text,p_title_en text,
  p_description_bn text,p_description_en text,p_price integer,p_published boolean,p_members uuid[]
) returns uuid language plpgsql security invoker set search_path='' as $$
begin
  if p_kind is null or p_kind not in ('ebook','physical') then raise exception 'invalid_bundle'; end if;
  return public.save_bundle_v2(p_id,p_slug,p_kind,p_title_bn,p_title_en,p_description_bn,p_description_en,
    p_price,p_published,(select jsonb_agg(jsonb_build_object('bookId',x,'format',p_kind)) from unnest(p_members) x));
end;
$$;
revoke all on function public.save_bundle_v2(uuid,text,text,text,text,text,text,integer,boolean,jsonb)
  from public,anon,authenticated;
grant execute on function public.save_bundle_v2(uuid,text,text,text,text,text,text,integer,boolean,jsonb) to service_role;

create or replace function public.create_physical_order(
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
      select * into b from public.books where id=item_id and published and archived_at is null and not is_demo for share;
      if not found then raise exception 'book_unavailable'; end if;
      insert into public.order_items(order_id,item_type,book_id,format,title_bn,title_en,quantity,unit_price_paisa)
        select o.id,'book',b.id,'physical',b.title_bn,b.title_en,qty,pe.price_paisa
        from public.print_editions pe where pe.book_id=b.id returning * into item;
      if not found then raise exception 'book_unavailable'; end if;
    else
      select * into bun from public.bundles where id=item_id and kind in ('physical','mixed') and published and archived_at is null for share;
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

create or replace function public.create_ebook_bundle_order(p_user uuid,p_bundle uuid,p_number text)
returns jsonb language plpgsql security invoker set search_path='' as $$
#variable_conflict use_column
declare bun public.bundles; o public.orders; item public.order_items; member record;
begin
  if p_number !~ '^01[3-9][0-9]{8}$' then raise exception 'invalid_receiver'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text||p_bundle::text||'ebook_bundle',0));
  select * into bun from public.bundles where id=p_bundle and kind='ebook' and published and archived_at is null for share;
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
  insert into public.order_item_members(order_item_id,book_id,title_bn,title_en,format)
    select item.id,b.id,b.title_bn,b.title_en,'ebook' from public.bundle_members bm
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
  else
    perform private.grant_order_ebooks(o.id);
  end if;
end;
$$;

create or replace function public.change_physical_order(
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
          where oi.order_id=p_order and oi.item_type='bundle' and m.format='physical'
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
    perform private.grant_order_ebooks(p_order);
  elsif p_action in ('cancel','cancel_paid') then
    if ship.fulfillment_status<>'placed' or
      (p_action='cancel' and o.status not in ('pending','rejected')) or
      (p_action='cancel_paid' and o.status<>'paid') then raise exception 'invalid_transition'; end if;
    for inv in
      with parts as (
        select oi.book_id,oi.quantity as qty from public.order_items oi where oi.order_id=p_order and oi.item_type='book'
        union all
        select m.book_id,oi.quantity from public.order_items oi join public.order_item_members m on m.order_item_id=oi.id
          where oi.order_id=p_order and oi.item_type='bundle' and m.format='physical'
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
    if p_action='cancel_paid' then
      update public.entitlements set revoked_at=now() where order_id=p_order and revoked_at is null;
    end if;
  elsif p_action='return' then
    if ship.fulfillment_status not in ('shipped','delivered') then raise exception 'invalid_transition'; end if;
    update public.order_shipping set fulfillment_status='returned',returned_at=now(),
      refund_due=(o.status='paid'),updated_at=now() where order_id=p_order;
    if o.status<>'paid' then update public.orders set status='cancelled' where id=p_order; end if;
  elsif p_action='refund' then
    if not ship.refund_due or o.status<>'paid' then raise exception 'invalid_transition'; end if;
    update public.order_shipping set refund_due=false,updated_at=now() where order_id=p_order;
    update public.orders set status='refunded' where id=p_order;
    update public.entitlements set revoked_at=now() where order_id=p_order and revoked_at is null;
  else raise exception 'invalid_action'; end if;
  insert into public.fulfillment_events(order_id,actor_id,action,note)
    values(p_order,p_actor,p_action,nullif(trim(p_note),''));
end;
$$;

notify pgrst, 'reload schema';
commit;
