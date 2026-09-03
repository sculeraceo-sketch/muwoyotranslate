create table if not exists public.subscription_plans (
  id text primary key,
  name text not null,
  translation_minutes integer not null default 0 check (translation_minutes >= 0),
  connect_minutes integer not null default 0 check (connect_minutes >= 0),
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'USD',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

insert into public.subscription_plans (id, name, translation_minutes, connect_minutes, price_cents)
values
  ('free', 'FREE', 10, 0, 0),
  ('starter', 'STARTER', 30, 10, 999),
  ('plus', 'PLUS', 75, 25, 1999),
  ('pro', 'PRO', 150, 50, 3499),
  ('ultra', 'ULTRA', 300, 100, 5999)
on conflict (id) do nothing;

alter table public.usage_balances
  add column if not exists translation_reserved integer not null default 0 check (translation_reserved >= 0),
  add column if not exists connect_reserved integer not null default 0 check (connect_reserved >= 0);

create table public.minute_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  minute_type text not null check (minute_type in ('translation', 'connect')),
  transaction_type text not null check (transaction_type in ('grant', 'purchase', 'reservation', 'consumption', 'release', 'lock', 'unlock')),
  minutes integer not null check (minutes > 0),
  reference_type text,
  reference_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index minute_transactions_user_created_idx on public.minute_transactions(user_id, created_at desc);
alter table public.minute_transactions enable row level security;
create policy "Users can read own minute transactions" on public.minute_transactions for select using (auth.uid() = user_id);

create or replace function public.reserve_connect_minutes(requested_minutes integer, session_reference uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  current_balance public.usage_balances;
begin
  if requested_minutes <= 0 then raise exception 'requested_minutes must be positive'; end if;
  select * into current_balance from public.usage_balances where user_id = auth.uid() for update;
  if current_balance.connect_remaining - current_balance.connect_reserved < requested_minutes then return false; end if;
  update public.usage_balances set connect_reserved = connect_reserved + requested_minutes where user_id = auth.uid();
  insert into public.minute_transactions(user_id, minute_type, transaction_type, minutes, reference_type, reference_id)
  values (auth.uid(), 'connect', 'reservation', requested_minutes, 'connect_session', session_reference);
  return true;
end;
$$;

create or replace function public.consume_connect_minutes(consumed_minutes integer, session_reference uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
declare
  current_balance public.usage_balances;
begin
  if consumed_minutes <= 0 then raise exception 'consumed_minutes must be positive'; end if;
  select * into current_balance from public.usage_balances where user_id = auth.uid() for update;
  if current_balance.connect_reserved < consumed_minutes or current_balance.connect_remaining < consumed_minutes then return false; end if;
  update public.usage_balances set connect_reserved = connect_reserved - consumed_minutes, connect_remaining = connect_remaining - consumed_minutes where user_id = auth.uid();
  insert into public.minute_transactions(user_id, minute_type, transaction_type, minutes, reference_type, reference_id)
  values (auth.uid(), 'connect', 'consumption', consumed_minutes, 'connect_session', session_reference);
  return true;
end;
$$;

create or replace function public.release_connect_minutes(released_minutes integer, session_reference uuid)
returns boolean
language plpgsql
security definer set search_path = public
as $$
begin
  if released_minutes <= 0 then return true; end if;
  update public.usage_balances set connect_reserved = greatest(connect_reserved - released_minutes, 0) where user_id = auth.uid();
  insert into public.minute_transactions(user_id, minute_type, transaction_type, minutes, reference_type, reference_id)
  values (auth.uid(), 'connect', 'release', released_minutes, 'connect_session', session_reference);
  return true;
end;
$$;

revoke all on function public.reserve_connect_minutes(integer, uuid) from public;
revoke all on function public.consume_connect_minutes(integer, uuid) from public;
revoke all on function public.release_connect_minutes(integer, uuid) from public;
grant execute on function public.reserve_connect_minutes(integer, uuid) to authenticated;
grant execute on function public.consume_connect_minutes(integer, uuid) to authenticated;
grant execute on function public.release_connect_minutes(integer, uuid) to authenticated;
