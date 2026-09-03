import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { AccessToken } from 'https://esm.sh/livekit-server-sdk@2.15.0';
import { adminClient, corsHeaders, json, requireUser } from '../_shared/auth.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(request);
    const { sessionId } = await request.json();
    const db = adminClient();
    const { data: session, error } = await db.from('connect_sessions').select('id, host_user_id, connector_user_id, livekit_room_name, status_v2').eq('id', sessionId).maybeSingle();
    if (error) throw error;
    if (!session || (session.host_user_id !== user.id && session.connector_user_id !== user.id)) return json({ error: 'Session not found' }, 404);
    if (!['paired', 'ready', 'inviting', 'active'].includes(session.status_v2)) return json({ error: 'Session is not ready' }, 409);
    const apiKey = Deno.env.get('LIVEKIT_API_KEY');
    const apiSecret = Deno.env.get('LIVEKIT_API_SECRET');
    const serverUrl = Deno.env.get('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !serverUrl) return json({ error: 'LiveKit is not configured' }, 503);
    const token = new AccessToken(apiKey, apiSecret, { identity: user.id, ttl: '10m' });
    token.addGrant({ room: session.livekit_room_name, roomJoin: true, canPublish: true, canSubscribe: true });
    return json({ serverUrl, roomName: session.livekit_room_name, token: await token.toJwt(), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error && error.message === 'Unauthorized' ? 'Unauthorized' : 'Unable to create LiveKit token' }, 500);
  }
});
