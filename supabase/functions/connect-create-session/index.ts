import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, corsHeaders, json, requireUser } from '../_shared/auth.ts';

function randomCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const value = Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
  return `${value.slice(0, 4)}-${value.slice(4)}`;
}

async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(request);
    const { sourceLanguage, targetLanguage } = await request.json();
    if (!sourceLanguage || !targetLanguage) return json({ error: 'Languages are required' }, 400);
    const pairingCode = randomCode();
    const pairingToken = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const sessionId = crypto.randomUUID();
    const roomName = `muwoyo-${sessionId}`;
    const db = adminClient();
    const { error } = await db.from('connect_sessions').insert({
      id: sessionId,
      host_user_id: user.id,
      participant_a_language: sourceLanguage,
      participant_b_language: targetLanguage,
      translation_source: 'secure-backend',
      livekit_room_name: roomName,
      pairing_token_hash: await hash(pairingToken),
      pairing_code: pairingCode,
      pairing_expires_at: expiresAt,
      billing_user_id: user.id,
      status_v2: 'waiting',
    });
    if (error) throw error;
    const { error: participantError } = await db.from('connect_participants').insert({ session_id: sessionId, user_id: user.id, role: 'host', language: sourceLanguage });
    if (participantError) throw participantError;
    return json({ sessionId, pairingCode, qrPayload: JSON.stringify({ sessionId, pairingToken, expiresAt }), expiresAt, status: 'waiting' });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error && error.message === 'Unauthorized' ? 'Unauthorized' : 'Unable to create session' }, 500);
  }
});
