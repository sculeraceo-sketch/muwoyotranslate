import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, corsHeaders, json, requireUser } from '../_shared/auth.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(request);
    const { sessionId } = await request.json();
    const db = adminClient();
    const { data: session, error } = await db.from('connect_sessions').select('*').eq('id', sessionId).maybeSingle();
    if (error) throw error;
    if (!session || (session.host_user_id !== user.id && session.connector_user_id !== user.id)) return json({ error: 'Session not found' }, 404);
    const ids = [session.host_user_id, session.connector_user_id].filter(Boolean);
    const { data: profiles, error: profilesError } = await db.from('profiles').select('id, name, avatar').in('id', ids);
    if (profilesError) throw profilesError;
    const host = profiles?.find((profile) => profile.id === session.host_user_id);
    const connector = profiles?.find((profile) => profile.id === session.connector_user_id);
    return json({ sessionId: session.id, status: session.status_v2, hostName: host?.name ?? 'Host', connectorName: connector?.name, hostLanguage: session.participant_a_language, connectorLanguage: session.participant_b_language });
  } catch (error) {
    console.error(error);
    return json({ error: 'Unable to load session' }, 500);
  }
});
