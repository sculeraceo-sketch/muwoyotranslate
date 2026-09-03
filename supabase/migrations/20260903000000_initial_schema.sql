create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  avatar text,
  plan_id text not null default 'free',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'light' check (theme in ('light', 'dark', 'system')),
  auto_detect boolean not null default true,
  default_source_language text not null default 'English',
  default_target_language text not null default 'Português',
  voice_playback boolean not null default true,
  playback_speed text not null default '1.0x',
  connect_auto_start_mic boolean not null default true,
  speaker_output boolean not null default true,
  usage_alerts boolean not null default true,
  subscription_alerts boolean not null default true,
  product_updates boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.usage_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  translation_total integer not null default 10 check (translation_total >= 0),
  translation_remaining integer not null default 10 check (translation_remaining >= 0),
  connect_total integer not null default 0 check (connect_total >= 0),
  connect_remaining integer not null default 0 check (connect_remaining >= 0),
  reset_at timestamptz not null default (date_trunc('month', now()) + interval '1 month')
);

create table public.translations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_language text not null,
  target_language text not null,
  original_text text not null,
  translated_text text not null,
  mode text not null default 'translation' check (mode in ('translation', 'connect')),
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  status text not null default 'active' check (status in ('active', 'canceled', 'past_due')),
  started_at timestamptz not null default now(),
  ends_at timestamptz
);

create index translations_user_created_idx on public.translations(user_id, created_at desc);
create index subscriptions_user_status_idx on public.subscriptions(user_id, status);

alter table public.profiles enable row level security;
alter table public.user_settings enable row level security;
alter table public.usage_balances enable row level security;
alter table public.translations enable row level security;
alter table public.subscriptions enable row level security;

create policy "Users can read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.profiles for insert with check (auth.uid() = id);

create policy "Users can manage own settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can read own balance" on public.usage_balances for select using (auth.uid() = user_id);
create policy "Users can read own translations" on public.translations for select using (auth.uid() = user_id);
create policy "Users can create own translations" on public.translations for insert with check (auth.uid() = user_id);
create policy "Users can delete own translations" on public.translations for delete using (auth.uid() = user_id);
create policy "Users can read own subscriptions" on public.subscriptions for select using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(coalesce(new.email, 'User'), '@', 1)), upper(left(coalesce(new.raw_user_meta_data->>'name', 'U'), 1)))
  on conflict (id) do nothing;
  insert into public.user_settings (user_id) values (new.id) on conflict (user_id) do nothing;
  insert into public.usage_balances (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
