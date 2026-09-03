create table public.connect_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  participant_a_language text not null,
  participant_b_language text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  status text not null default 'complete' check (status in ('active', 'complete')),
  created_at timestamptz not null default now()
);

create table public.connect_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.connect_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  speaker text not null,
  source_language text not null,
  target_language text not null,
  text text not null,
  translated_text text not null,
  created_at timestamptz not null default now()
);

create index connect_sessions_user_created_idx on public.connect_sessions(user_id, created_at desc);
create index connect_messages_session_created_idx on public.connect_messages(session_id, created_at asc);

alter table public.connect_sessions enable row level security;
alter table public.connect_messages enable row level security;

create policy "Users can manage own connect sessions" on public.connect_sessions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users can manage own connect messages" on public.connect_messages for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
