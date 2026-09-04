import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import type { ExpoSpeechRecognitionErrorEvent, ExpoSpeechRecognitionResultEvent } from 'expo-speech-recognition';

export type OfflineSpeechStatus = 'idle' | 'listening' | 'processing';

export type OfflineSpeechState = {
  status: OfflineSpeechStatus;
  transcript: string;
  detectedLanguage?: string;
  error?: string;
};

type NativeSpeechModule = typeof ExpoSpeechRecognitionModule & {
  getSupportedLocales?: () => Promise<string[]>;
  supportsOnDeviceRecognition?: () => boolean;
  androidTriggerOfflineModelDownload?: (locale: string) => Promise<void>;
};

const nativeSpeech = ExpoSpeechRecognitionModule as NativeSpeechModule;

function normalizeLocale(language: string) {
  const aliases: Record<string, string> = { Portuguese: 'pt-PT', English: 'en-US', Spanish: 'es-ES', French: 'fr-FR', German: 'de-DE', Italian: 'it-IT', Chinese: 'zh-CN', Japanese: 'ja-JP' };
  return aliases[language] ?? language;
}

export async function getOfflineSpeechLocales() {
  if (!nativeSpeech.getSupportedLocales) return [];
  return nativeSpeech.getSupportedLocales();
}

export async function isOfflineSpeechSupported(language: string) {
  const locale = normalizeLocale(language).toLowerCase();
  const locales = await getOfflineSpeechLocales();
  return locales.length === 0 || locales.some((supported) => supported.toLowerCase() === locale || supported.toLowerCase().startsWith(`${locale.split('-')[0]}-`));
}

export async function downloadOfflineSpeechModel(language: string) {
  const locale = normalizeLocale(language);
  if (Platform.OS === 'android' && nativeSpeech.androidTriggerOfflineModelDownload) await nativeSpeech.androidTriggerOfflineModelDownload(locale);
}

export function useOfflineSpeechRecognition(language: string) {
  const [state, setState] = useState<OfflineSpeechState>({ status: 'idle', transcript: '' });
  const finalTranscript = useRef('');

  useEffect(() => {
    const subscriptions = [
      ExpoSpeechRecognitionModule.addListener('start', () => setState((current) => ({ ...current, status: 'listening', error: undefined }))),
      ExpoSpeechRecognitionModule.addListener('result', (event: ExpoSpeechRecognitionResultEvent) => {
        const transcript = event.results[0]?.transcript ?? '';
        if (event.isFinal) finalTranscript.current = transcript;
        setState((current) => ({ ...current, status: event.isFinal ? 'processing' : 'listening', transcript }));
      }),
      ExpoSpeechRecognitionModule.addListener('languagedetection', (event: { detectedLanguage: string }) => setState((current) => ({ ...current, detectedLanguage: event.detectedLanguage }))),
      ExpoSpeechRecognitionModule.addListener('error', (event: ExpoSpeechRecognitionErrorEvent) => setState({ status: 'idle', transcript: '', error: event.error === 'language-not-supported' ? 'Offline speech recognition is not available for this language on this device.' : 'Offline speech recognition could not start.' })),
      ExpoSpeechRecognitionModule.addListener('end', () => setState((current) => ({ ...current, status: current.transcript ? 'processing' : 'idle' }))),
    ];
    return () => subscriptions.forEach((subscription) => subscription.remove());
  }, []);

  const start = async () => {
    const supported = await isOfflineSpeechSupported(language);
    if (!supported) {
      setState({ status: 'idle', transcript: '', error: 'Offline speech recognition is not available for this language on this device.' });
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setState({ status: 'idle', transcript: '', error: 'Microphone and speech recognition permission are required.' });
      return;
    }
    finalTranscript.current = '';
    setState({ status: 'listening', transcript: '' });
    ExpoSpeechRecognitionModule.start({ lang: normalizeLocale(language), interimResults: true, continuous: false, requiresOnDeviceRecognition: true, addsPunctuation: true, androidIntentOptions: { EXTRA_PREFER_OFFLINE: true }, androidRecognitionServicePackage: Platform.OS === 'android' ? 'com.google.android.as' : undefined });
  };

  const stop = () => {
    setState((current) => ({ ...current, status: 'processing' }));
    ExpoSpeechRecognitionModule.stop();
  };

  const cancel = () => {
    ExpoSpeechRecognitionModule.abort();
    finalTranscript.current = '';
    setState({ status: 'idle', transcript: '' });
  };

  return { ...state, start, stop, cancel, transcript: finalTranscript.current || state.transcript };
}
