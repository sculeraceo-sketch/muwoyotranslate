import { supabase } from '../supabase';

export interface SpeechRecognitionService {
  transcribe(audioBase64: string, language?: string): Promise<{ text: string; detectedLanguage?: string }>;
}

export interface TextToSpeechService {
  synthesize(text: string, language: string): Promise<{ audioUrl: string }>;
}

export const speechRecognitionService: SpeechRecognitionService = {
  async transcribe(audioBase64, language) {
    const { data, error } = await supabase.functions.invoke('transcribe', { body: { audioBase64, language } });
    if (error) throw new Error('Não foi possível reconhecer o áudio.');
    return data;
  },
};

export const textToSpeechService: TextToSpeechService = {
  async synthesize(text, language) {
    const { data, error } = await supabase.functions.invoke('synthesize-speech', { body: { text, language } });
    if (error) throw new Error('Não foi possível gerar o áudio.');
    return data;
  },
};
