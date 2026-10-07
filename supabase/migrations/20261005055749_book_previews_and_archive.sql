-- Preview files remain private. Only safe preview metadata reaches public pages.
alter table public.books add column archived_at timestamptz;
alter table public.books add constraint archived_books_unpublished
  check (archived_at is null or not published);
drop policy published_books on public.books;
create policy published_books on public.books for select to anon, authenticated
  using (published and archived_at is null);

create table public.book_previews (
  book_id uuid primary key references public.books(id) on delete cascade,
  source_kind text not null check (source_kind in ('book_pdf','sample_pdf')),
  source_path text not null,
  source_page_count integer not null check (source_page_count between 1 and 20000),
  preview_path text unique,
  preview_pages integer not null default 0 check (preview_pages between 0 and 20000),
  updated_at timestamptz not null default now(),
  check (preview_pages <= source_page_count),
  check (preview_pages = 0 and preview_path is null or preview_pages > 0 and preview_path is not null),
  check (source_kind <> 'book_pdf' or preview_pages < source_page_count)
);
alter table public.book_previews enable row level security;
revoke all on public.book_previews from public, anon, authenticated;
grant all on public.book_previews to service_role;

-- Storage cannot join a PostgreSQL transaction. Record objects for safe retry
-- after an unsold book is removed from relational tables.
create table public.storage_cleanup_jobs (
  id bigint generated always as identity primary key,
  book_id uuid not null,
  bucket text not null check (bucket in ('ebooks','covers')),
  object_path text not null,
  created_at timestamptz not null default now(),
  done_at timestamptz,
  unique(bucket, object_path)
);
alter table public.storage_cleanup_jobs enable row level security;
revoke all on public.storage_cleanup_jobs from public, anon, authenticated;
grant all on public.storage_cleanup_jobs to service_role;

create function public.delete_unsold_book(p_book uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare
  b public.books;
begin
  select * into b from public.books where id=p_book for update;
  if not found then raise exception 'book_not_found'; end if;
  if exists(select 1 from public.orders where book_id=p_book) then
    raise exception 'book_has_orders';
  end if;
  insert into public.storage_cleanup_jobs(book_id,bucket,object_path)
    select p_book,'covers',b.cover_path where b.cover_path is not null
    union
    select p_book,'ebooks',storage_path from public.book_formats where book_id=p_book
    union
    select p_book,'ebooks',source_path from public.book_previews where book_id=p_book and source_kind='sample_pdf'
    union
    select p_book,'ebooks',preview_path from public.book_previews where book_id=p_book and preview_path is not null
    union
    select p_book,bucket_id,name from storage.objects
      where bucket_id in ('ebooks','covers') and left(name,length(p_book::text)+1)=p_book::text||'/'
  on conflict(bucket,object_path) do nothing;
  delete from public.book_previews where book_id=p_book;
  delete from public.book_formats where book_id=p_book;
  delete from public.books where id=p_book;
  return true;
end;
$$;
revoke all on function public.delete_unsold_book(uuid) from public, anon, authenticated;
grant execute on function public.delete_unsold_book(uuid) to service_role;

-- Keep the active paid PDF and its public excerpt in sync on replacement.
create function public.replace_pdf_with_preview(
  p_book uuid, p_path text, p_name text, p_size integer,
  p_preview_path text, p_preview_pages integer, p_source_pages integer,
  p_expected_path text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare old_path text; old_pages integer; archived timestamptz;
begin
  select archived_at into archived from public.books where id=p_book for update;
  if not found then raise exception 'book_not_found'; end if;
  if archived is not null then raise exception 'book_archived'; end if;
  select preview_path,preview_pages into old_path,old_pages
    from public.book_previews where book_id=p_book for update;
  if old_path is distinct from p_expected_path or old_pages is distinct from p_preview_pages
    then raise exception 'preview_changed'; end if;
  insert into public.book_formats(book_id,format,storage_path,original_name,size_bytes)
    values(p_book,'pdf',p_path,p_name,p_size)
    on conflict(book_id,format) do update set
      storage_path=excluded.storage_path,
      original_name=excluded.original_name,
      size_bytes=excluded.size_bytes;
  insert into public.book_previews(book_id,source_kind,source_path,source_page_count,preview_path,preview_pages)
    values(p_book,'book_pdf',p_path,p_source_pages,p_preview_path,p_preview_pages)
    on conflict(book_id) do update set
      source_kind=excluded.source_kind,
      source_path=excluded.source_path,
      source_page_count=excluded.source_page_count,
      preview_path=excluded.preview_path,
      preview_pages=excluded.preview_pages,
      updated_at=now();
  return true;
end;
$$;
revoke all on function public.replace_pdf_with_preview(uuid,text,text,integer,text,integer,integer,text)
  from public, anon, authenticated;
grant execute on function public.replace_pdf_with_preview(uuid,text,text,integer,text,integer,integer,text)
  to service_role;

create function public.replace_pdf_without_preview(
  p_book uuid, p_path text, p_name text, p_size integer, p_expected_path text
) returns boolean language plpgsql security invoker set search_path='' as $$
declare old_path text; old_source text; old_kind text; archived timestamptz;
begin
  select archived_at into archived from public.books where id=p_book for update;
  if not found then raise exception 'book_not_found'; end if;
  if archived is not null then raise exception 'book_archived'; end if;
  select preview_path,source_path,source_kind into old_path,old_source,old_kind
    from public.book_previews where book_id=p_book for update;
  if old_path is distinct from p_expected_path or old_path is not null
    then raise exception 'preview_changed'; end if;
  insert into public.book_formats(book_id,format,storage_path,original_name,size_bytes)
    values(p_book,'pdf',p_path,p_name,p_size)
    on conflict(book_id,format) do update set
      storage_path=excluded.storage_path,
      original_name=excluded.original_name,
      size_bytes=excluded.size_bytes;
  if old_kind='sample_pdf' then
    insert into public.storage_cleanup_jobs(book_id,bucket,object_path)
      values(p_book,'ebooks',old_source) on conflict(bucket,object_path) do nothing;
  end if;
  delete from public.book_previews where book_id=p_book;
  return true;
end;
$$;
revoke all on function public.replace_pdf_without_preview(uuid,text,text,integer,text)
  from public, anon, authenticated;
grant execute on function public.replace_pdf_without_preview(uuid,text,text,integer,text)
  to service_role;

-- Serialize preview changes with PDF replacement and reject stale admin tabs.
create function public.save_book_preview(
  p_book uuid, p_expected_path text, p_expected_source text, p_source_kind text, p_source_path text,
  p_source_pages integer, p_preview_path text, p_preview_pages integer
) returns boolean language plpgsql security invoker set search_path='' as $$
declare b public.books; old_path text; old_source text;
begin
  select * into b from public.books where id=p_book for update;
  if not found then raise exception 'book_not_found'; end if;
  if b.archived_at is not null then raise exception 'book_archived'; end if;
  select preview_path,source_path into old_path,old_source from public.book_previews where book_id=p_book for update;
  if old_path is distinct from p_expected_path or old_source is distinct from p_expected_source
    then raise exception 'preview_changed'; end if;
  if p_source_kind='book_pdf' and not exists(
    select 1 from public.book_formats where book_id=p_book and format='pdf' and storage_path=p_source_path
  ) then raise exception 'preview_source_changed'; end if;
  if p_source_kind='sample_pdf' and (
    exists(select 1 from public.book_formats where book_id=p_book and format='pdf') or
    not exists(select 1 from public.book_formats where book_id=p_book and format='epub')
  ) then raise exception 'preview_source_changed'; end if;
  insert into public.book_previews(book_id,source_kind,source_path,source_page_count,preview_path,preview_pages)
    values(p_book,p_source_kind,p_source_path,p_source_pages,p_preview_path,p_preview_pages)
    on conflict(book_id) do update set
      source_kind=excluded.source_kind, source_path=excluded.source_path,
      source_page_count=excluded.source_page_count, preview_path=excluded.preview_path,
      preview_pages=excluded.preview_pages, updated_at=now();
  return true;
end;
$$;
revoke all on function public.save_book_preview(uuid,text,text,text,text,integer,text,integer)
  from public, anon, authenticated;
grant execute on function public.save_book_preview(uuid,text,text,text,text,integer,text,integer)
  to service_role;

-- Order creation must not race with archiving or permanent deletion.
create function private.ensure_book_sellable() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
  perform 1 from public.books where id=new.book_id and published and archived_at is null for share;
  if not found then raise exception 'book_unavailable'; end if;
  return new;
end;
$$;
create trigger books_sellable_before_order before insert on public.orders
  for each row execute function private.ensure_book_sellable();
revoke all on function private.ensure_book_sellable() from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.ensure_book_sellable() to service_role;
