import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, corsHeaders, json, requireUser } from '../_shared/auth.ts';

async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(request);
    const { pairingCode, sessionId, pairingToken } = await request.json();
    if (!pairingCode && (!sessionId || !pairingToken)) return json({ error: 'Pairing code or QR payload is required' }, 400);
    const db = adminClient();
    let query = db.from('connect_sessions').select('*');
    const { data: session, error } = pairingCode
      ? await query.eq('pairing_code', pairingCode.trim().toUpperCase()).maybeSingle()
      : await query.eq('id', sessionId).eq('pairing_token_hash', await hash(pairingToken)).maybeSingle();
    if (error) throw error;
    if (!session || session.host_user_id === user.id) return json({ error: 'Invalid pairing code' }, 400);
    if (session.status_v2 !== 'waiting' || !session.pairing_expires_at || new Date(session.pairing_expires_at) <= new Date()) return json({ error: 'Session expired or unavailable' }, 410);
    const { error: updateError } = await db.from('connect_sessions').update({ connector_user_id: user.id, status_v2: 'paired', updated_at: new Date().toISOString() }).eq('id', session.id).eq('status_v2', 'waiting');
    if (updateError) throw updateError;
    const { error: participantError } = await db.from('connect_participants').insert({ session_id: session.id, user_id: user.id, role: 'connector', language: session.participant_b_language });
    if (participantError) throw participantError;
    return json({ sessionId: session.id, status: 'paired' });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error && error.message === 'Unauthorized' ? 'Unauthorized' : 'Unable to join session' }, 500);
  }
});
