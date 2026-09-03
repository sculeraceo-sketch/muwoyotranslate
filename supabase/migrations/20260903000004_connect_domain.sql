alter table public.translations add column if not exists audio_available boolean not null default false;

alter table public.connect_sessions
  rename column user_id to host_user_id;

alter table public.connect_sessions
  add column if not exists connector_user_id uuid references auth.users(id) on delete set null,
  add column if not exists status_v2 text,
  add column if not exists livekit_room_name text,
  add column if not exists pairing_token_hash text,
  add column if not exists pairing_code text,
  add column if not exists pairing_expires_at timestamptz,
  add column if not exists session_started_at timestamptz,
  add column if not exists session_ended_at timestamptz,
  add column if not exists billing_user_id uuid references auth.users(id) on delete set null,
  add column if not exists translation_source text,
  add column if not exists connect_version integer not null default 1,
  add column if not exists updated_at timestamptz not null default now();

update public.connect_sessions set status_v2 = case when status = 'active' then 'active' else 'ended' end where status_v2 is null;
alter table public.connect_sessions alter column status_v2 set default 'waiting';
alter table public.connect_sessions add constraint connect_sessions_status_v2_check check (status_v2 in ('waiting','paired','ready','inviting','active','paused','reconnecting','declined','ended','expired','cancelled'));

create table public.connect_participants (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.connect_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('host', 'connector')),
  language text not null,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  unique(session_id, user_id),
  unique(session_id, role)
);

create table public.connect_invitations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.connect_sessions(id) on delete cascade,
  host_user_id uuid not null references auth.users(id) on delete cascade,
  connector_user_id uuid references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

alter table public.connect_participants enable row level security;
alter table public.connect_invitations enable row level security;

create policy "Participants can read their session participants" on public.connect_participants for select using (auth.uid() = user_id or exists (select 1 from public.connect_participants own where own.session_id = connect_participants.session_id and own.user_id = auth.uid()));
create policy "Users can read their invitations" on public.connect_invitations for select using (auth.uid() = host_user_id or auth.uid() = connector_user_id);

create index connect_sessions_pairing_code_idx on public.connect_sessions(pairing_code) where pairing_code is not null;
create index connect_participants_user_idx on public.connect_participants(user_id);
create index connect_invitations_connector_idx on public.connect_invitations(connector_user_id, status);
