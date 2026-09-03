alter table public.profiles
  add column if not exists phone text,
  add column if not exists country text,
  add column if not exists primary_language text;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar, phone, country, primary_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'User'), '@', 1)),
    upper(left(coalesce(new.raw_user_meta_data->>'name', 'U'), 1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'country',
    new.raw_user_meta_data->>'primary_language'
  )
  on conflict (id) do update set
    name = excluded.name,
    phone = excluded.phone,
    country = excluded.country,
    primary_language = excluded.primary_language,
    updated_at = now();
  insert into public.user_settings (user_id, default_source_language, default_target_language)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'primary_language', 'English'),
    coalesce(new.raw_user_meta_data->>'translation_language', 'Português')
  )
  on conflict (user_id) do update set
    default_source_language = excluded.default_source_language,
    default_target_language = excluded.default_target_language,
    updated_at = now();
  insert into public.usage_balances (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
