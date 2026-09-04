import { supabase } from '../supabase';
import { ConnectConversationEvent, RealtimeConnectionState } from '../types';

export const realtimeSessionService = {
  subscribeToSession(sessionId: string, onEvent: (event: ConnectConversationEvent) => void, onState?: (state: RealtimeConnectionState) => void) {
    const channel = supabase.channel(`connect-session:${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'connect_messages', filter: `session_id=eq.${sessionId}` }, (payload) => {
        const message = payload.new as { id: string; session_id: string; user_id: string; speaker: string; source_language: string; target_language: string; text: string; translated_text: string; created_at: string };
        onEvent({ id: message.id, sessionId: message.session_id, speakerUserId: message.user_id, listenerUserId: '', sourceLanguage: message.source_language, targetLanguage: message.target_language, originalTranscript: message.text, translatedText: message.translated_text, createdAt: message.created_at });
      })
      .subscribe((status) => onState?.(status === 'SUBSCRIBED' ? 'connected' : status === 'CHANNEL_ERROR' ? 'error' : 'connecting'));
    return () => { void supabase.removeChannel(channel); };
  },

  async publishConversationEvent(event: Omit<ConnectConversationEvent, 'id' | 'createdAt'>) {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error('Sessão expirada.');
    const { error } = await supabase.from('connect_messages').insert({
      session_id: event.sessionId,
      user_id: userData.user.id,
      speaker: event.speakerUserId,
      source_language: event.sourceLanguage,
      target_language: event.targetLanguage,
      text: event.originalTranscript,
      translated_text: event.translatedText,
    });
    if (error) throw error;
  },
};
