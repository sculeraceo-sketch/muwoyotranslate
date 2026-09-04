create policy "Session participants can read connect messages" on public.connect_messages for select using (
  exists (
    select 1 from public.connect_participants
    where connect_participants.session_id = connect_messages.session_id
      and connect_participants.user_id = auth.uid()
  )
);

alter publication supabase_realtime add table public.connect_messages;