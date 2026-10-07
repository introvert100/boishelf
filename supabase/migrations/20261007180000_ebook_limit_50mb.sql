-- Supabase Free caps individual objects at 50 MB. Keep covers at 5 MB.
alter table public.book_formats
  drop constraint if exists book_formats_size_bytes_check;
alter table public.book_formats
  add constraint book_formats_size_bytes_check check (size_bytes between 1 and 52428800);

update storage.buckets
set file_size_limit = 52428800
where id = 'ebooks' and public = false;
