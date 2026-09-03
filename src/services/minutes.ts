import { supabase } from '../supabase';
import { MinuteType } from '../types';

export const minuteService = {
  async getBalance() {
    const { data, error } = await supabase.from('usage_balances').select('*').single();
    if (error) throw error;
    return data;
  },

  async reserveConnect(minutes: number, sessionId: string) {
    const { data, error } = await supabase.rpc('reserve_connect_minutes', {
      requested_minutes: minutes,
      session_reference: sessionId,
    });
    if (error) throw error;
    return Boolean(data);
  },

  async consumeConnect(minutes: number, sessionId: string) {
    const { data, error } = await supabase.rpc('consume_connect_minutes', {
      consumed_minutes: minutes,
      session_reference: sessionId,
    });
    if (error) throw error;
    return Boolean(data);
  },

  async releaseConnect(minutes: number, sessionId: string) {
    const { data, error } = await supabase.rpc('release_connect_minutes', {
      released_minutes: minutes,
      session_reference: sessionId,
    });
    if (error) throw error;
    return Boolean(data);
  },

  async authorizeTranslation() {
    const { data, error } = await supabase.functions.invoke('translate', { body: { minuteType: 'translation' satisfies MinuteType } });
    if (error) throw error;
    return data;
  },
};
