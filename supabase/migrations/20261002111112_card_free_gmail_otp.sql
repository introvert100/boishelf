-- Replace Google OAuth-only registration with Gmail email OTP authentication.
create or replace function public.before_user_created_hook(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
begin
  if coalesce(event->'user'->>'email','') !~* '^[^@[:space:]]+@gmail\.com$'
     or coalesce(event->'user'->'app_metadata'->>'provider','') <> 'email' then
    return '{"error":{"http_code":403,"message":"Only Gmail email-code sign-in is allowed."}}'::jsonb;
  end if;
  return '{}'::jsonb;
end;
$$;
revoke all on function public.before_user_created_hook(jsonb) from public, anon, authenticated;
grant execute on function public.before_user_created_hook(jsonb) to supabase_auth_admin;

-- Configure this as the Custom Access Token hook. It blocks password, OAuth,
-- anonymous and recovery sessions while preserving OTP session refreshes.
create or replace function public.gmail_otp_access_token_hook(event jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare method text := coalesce(event->>'authentication_method','');
begin
  if coalesce(event->'claims'->>'email','') !~* '^[^@[:space:]]+@gmail\.com$'
     or method not in ('otp','token_refresh')
     or (method = 'token_refresh' and not exists (
       select 1
       from jsonb_array_elements(coalesce(event->'claims'->'amr','[]'::jsonb)) as entry
       where case
         when jsonb_typeof(entry) = 'string' then trim(both '"' from entry::text)
         else entry->>'method'
       end = 'otp'
     )) then
    raise exception 'Only Gmail email-code sessions are allowed.';
  end if;
  return jsonb_build_object('claims', event->'claims');
end;
$$;
revoke all on function public.gmail_otp_access_token_hook(jsonb) from public, anon, authenticated;
grant execute on function public.gmail_otp_access_token_hook(jsonb) to supabase_auth_admin;
