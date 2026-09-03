import { supabase } from '../supabase';
import { TranslationRecord } from '../types';

export interface TranslationRequest {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  autoDetect?: boolean;
}

export interface TranslationResponse {
  originalText: string;
  translatedText: string;
  detectedLanguage?: string;
  audioUrl?: string;
}

export interface TranslationProvider {
  translateText(request: TranslationRequest): Promise<TranslationResponse>;
  translateSpeech(audioBase64: string, request: Omit<TranslationRequest, 'text'>): Promise<TranslationResponse>;
}

export const translationService: TranslationProvider = {
  async translateText(request) {
    const { data, error } = await supabase.functions.invoke('translate', { body: request });
    if (error) throw new Error('A tradução não pôde ser concluída.');
    return data as TranslationResponse;
  },

  async translateSpeech(audioBase64, request) {
    const { data, error } = await supabase.functions.invoke('translate-speech', { body: { audioBase64, ...request } });
    if (error) throw new Error('O áudio não pôde ser traduzido.');
    return data as TranslationResponse;
  },
};

export async function saveTranslationRecord(record: Omit<TranslationRecord, 'id' | 'createdAt'>) {
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('Sessão expirada.');
  const { error } = await supabase.from('translations').insert({
    user_id: userData.user.id,
    source_language: record.sourceLanguage,
    target_language: record.targetLanguage,
    original_text: record.originalText,
    translated_text: record.translatedText,
    mode: record.mode,
    duration_seconds: 0,
    audio_available: record.audioAvailable,
  });
  if (error) throw error;
}
