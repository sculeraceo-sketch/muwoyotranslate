import { supabase } from '../supabase';
import { ConnectSessionStatus, LiveKitRoomInfo } from '../types';

export const connectService = {
  async createHostSession(sourceLanguage: string, targetLanguage: string) {
    const { data, error } = await supabase.functions.invoke('connect-create-session', {
      body: { sourceLanguage, targetLanguage },
    });
    if (error) throw new Error('Não foi possível criar a conversa.');
    return data as { sessionId: string; pairingCode: string; qrPayload: string; expiresAt: string; status: ConnectSessionStatus };
  },

  async joinWithCode(pairingCode: string) {
    const { data, error } = await supabase.functions.invoke('connect-join-session', { body: { pairingCode } });
    if (error) throw new Error('Código inválido ou expirado.');
    return data as { sessionId: string; status: ConnectSessionStatus };
  },

  async joinWithQr(sessionId: string, pairingToken: string) {
    const { data, error } = await supabase.functions.invoke('connect-join-session', { body: { sessionId, pairingToken } });
    if (error) throw new Error('QR code inválido ou expirado.');
    return data as { sessionId: string; status: ConnectSessionStatus };
  },

  async getLiveKitToken(sessionId: string) {
    const { data, error } = await supabase.functions.invoke('connect-livekit-token', { body: { sessionId } });
    if (error) throw new Error('Não foi possível iniciar a ligação.');
    return data as LiveKitRoomInfo;
  },

  async getSession(sessionId: string) {
    const { data, error } = await supabase.functions.invoke('connect-session-details', { body: { sessionId } });
    if (error) throw new Error('Não foi possível carregar a conversa.');
    return data as { sessionId: string; status: ConnectSessionStatus; hostName: string; connectorName?: string; hostLanguage: string; connectorLanguage: string };
  },

  async updateStatus(sessionId: string, status: ConnectSessionStatus) {
    const { data, error } = await supabase.functions.invoke('connect-update-status', { body: { sessionId, status } });
    if (error) throw new Error('Não foi possível atualizar a conversa.');
    return data;
  },

  subscribe(sessionId: string, onChange: (payload: unknown) => void) {
    const channel = supabase.channel(`connect:${sessionId}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'connect_sessions', filter: `id=eq.${sessionId}`,
    }, onChange).subscribe();
    return () => { void supabase.removeChannel(channel); };
  },

  async endSession(sessionId: string) {
    return this.updateStatus(sessionId, 'ended');
  },

  async cancelSession(sessionId: string) {
    return this.updateStatus(sessionId, 'cancelled');
  },
};
