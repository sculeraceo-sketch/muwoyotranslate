import AsyncStorage from '@react-native-async-storage/async-storage';
import { onPrepareTranslation, onTranslateTask } from 'expo-translate-text';
import { Platform } from 'react-native';

const INSTALLED_PACKS_KEY = 'muwoyo.offlineLanguagePacks';

export type OfflinePack = {
  code: string;
  installed: boolean;
  downloading: boolean;
  downloadProgress: number;
};

async function readInstalled() {
  const value = await AsyncStorage.getItem(INSTALLED_PACKS_KEY);
  return value ? JSON.parse(value) as string[] : [];
}

async function writeInstalled(codes: string[]) {
  await AsyncStorage.setItem(INSTALLED_PACKS_KEY, JSON.stringify([...new Set(codes)]));
}

export const offlineTranslationService = {
  async getInstalledLanguages() {
    return readInstalled();
  },

  async isLanguagePairInstalled(sourceCode: string, targetCode: string) {
    const installed = await readInstalled();
    return installed.includes(sourceCode) && installed.includes(targetCode);
  },

  async downloadLanguagePack(sourceCode: string, targetCode: string) {
    if (Platform.OS === 'ios') {
      const result = await onPrepareTranslation({ sourceLangCode: sourceCode, targetLangCode: targetCode });
      if (result.status !== 'prepared') throw new Error('O download do idioma foi cancelado.');
    }
    // Android ML Kit downloads the selected model on its first translation request.
    await writeInstalled([...(await readInstalled()), sourceCode, targetCode]);
  },

  async translateOffline(text: string, sourceCode: string | undefined, targetCode: string) {
    const result = await onTranslateTask({ input: text, sourceLangCode: sourceCode, targetLangCode: targetCode, preferredStrategy: 'lowLatency' });
    const translatedText = typeof result.translatedTexts === 'string' ? result.translatedTexts : '';
    if (!translatedText) throw new Error('A tradução offline não retornou resultado.');
    await writeInstalled([...(await readInstalled()), result.sourceLanguage ?? sourceCode ?? 'auto', targetCode]);
    return { translatedText, detectedLanguage: result.sourceLanguage };
  },
};
