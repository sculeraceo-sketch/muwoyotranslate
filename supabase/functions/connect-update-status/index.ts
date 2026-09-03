import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { adminClient, corsHeaders, json, requireUser } from '../_shared/auth.ts';

const allowedTransitions: Record<string, string[]> = {
  waiting: ['paired', 'expired', 'cancelled'],
  paired: ['ready', 'inviting', 'cancelled'],
  ready: ['inviting', 'cancelled'],
  inviting: ['active', 'declined', 'ended'],
  active: ['paused', 'reconnecting', 'ended'],
  paused: ['active', 'ended'],
  reconnecting: ['active', 'ended'],
};

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const { user } = await requireUser(request);
    const { sessionId, status } = await request.json();
    const db = adminClient();
    const { data: session, error } = await db.from('connect_sessions').select('id, host_user_id, connector_user_id, status_v2').eq('id', sessionId).maybeSingle();
    if (error) throw error;
    if (!session || (session.host_user_id !== user.id && session.connector_user_id !== user.id)) return json({ error: 'Session not found' }, 404);
    if (!allowedTransitions[session.status_v2]?.includes(status)) return json({ error: 'Invalid session transition' }, 409);
    if (status === 'active' && session.host_user_id !== user.id) return json({ error: 'Only the host can start the session' }, 403);
    const updates: Record<string, unknown> = { status_v2: status, updated_at: new Date().toISOString() };
    if (status === 'active') updates.session_started_at = new Date().toISOString();
    if (['ended', 'declined', 'expired', 'cancelled'].includes(status)) updates.session_ended_at = new Date().toISOString();
    const { error: updateError } = await db.from('connect_sessions').update(updates).eq('id', sessionId).eq('status_v2', session.status_v2);
    if (updateError) throw updateError;
    return json({ sessionId, status });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error && error.message === 'Unauthorized' ? 'Unauthorized' : 'Unable to update session' }, 500);
  }
});
