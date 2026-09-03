import { create } from 'zustand';
import { plans } from './catalog';
import { supabase } from './supabase';
import { TranslationHistoryItem, UserProfile, UserSettings } from './types';

interface AppState {
  user: UserProfile;
  selectedPlanId: string;
  onboardingComplete: boolean;
  isAuthenticated: boolean;
  authReady: boolean;
  theme: UserSettings['theme'];
  sourceLanguage: string;
  targetLanguage: string;
  autoDetect: boolean;
  detectedLanguage: string | null;
  userSettings: UserSettings;
  balances: {
    translationTotal: number;
    translationRemaining: number;
    connectTotal: number;
    connectRemaining: number;
  };
  history: TranslationHistoryItem[];
  setSourceLanguage: (language: string) => void;
  setTargetLanguage: (language: string) => void;
  swapLanguages: () => void;
  setAutoDetect: (value: boolean) => void;
  setAuthState: (value: boolean) => void;
  setOnboardingComplete: (value: boolean) => void;
  setTheme: (value: UserSettings['theme']) => void;
  setSelectedPlan: (planId: string) => void;
  addHistoryItem: (item: TranslationHistoryItem) => void;
  saveTranslation: (item: Omit<TranslationHistoryItem, 'id' | 'date' | 'duration'>) => Promise<void>;
  addMinutes: (translation?: number, connect?: number) => void;
  hydrateSession: () => Promise<void>;
}

export const useAppStore = create<AppState>((set) => ({
  user: { id: '', name: 'User', email: '', avatar: 'U', planId: 'free' },
  selectedPlanId: 'free',
  onboardingComplete: false,
  isAuthenticated: false,
  authReady: false,
  theme: 'system',
  sourceLanguage: 'English',
  targetLanguage: 'Portuguese',
  autoDetect: true,
  detectedLanguage: 'English',
  userSettings: {
    theme: 'system',
    autoDetect: true,
    defaultSourceLanguage: 'English',
    defaultTargetLanguage: 'Portuguese',
    voicePlayback: true,
    playbackSpeed: '1.0x',
    connectAutoStartMic: true,
    speakerOutput: true,
    notifications: {
      usageAlerts: true,
      subscriptionAlerts: true,
      productUpdates: false,
    },
  },
  balances: { translationTotal: 0, translationRemaining: 0, connectTotal: 0, connectRemaining: 0 },
  history: [],
  setSourceLanguage: (language) => set({ sourceLanguage: language }),
  setTargetLanguage: (language) => set({ targetLanguage: language }),
  swapLanguages: () =>
    set((state) => ({
      sourceLanguage: state.targetLanguage,
      targetLanguage: state.sourceLanguage,
    })),
  setAutoDetect: (value) =>
    set((state) => ({
      autoDetect: value,
      detectedLanguage: value ? 'English' : null,
      userSettings: { ...state.userSettings, autoDetect: value },
    })),
  setAuthState: (value) => set({ isAuthenticated: value, authReady: true }),
  setOnboardingComplete: (value) => set({ onboardingComplete: value }),
  setTheme: (value) =>
    set((state) => ({
      theme: value,
      userSettings: { ...state.userSettings, theme: value },
    })),
  setSelectedPlan: (planId) => set({ selectedPlanId: planId }),
  addHistoryItem: (item) => set((state) => ({ history: [item, ...state.history] })),
  saveTranslation: async (item) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('translations').insert({
      user_id: user.id,
      source_language: item.sourceLanguage,
      target_language: item.targetLanguage,
      original_text: item.originalText,
      translated_text: item.translatedText,
      mode: item.mode,
      duration_seconds: 0,
    });
    const { hydrateSession } = useAppStore.getState();
    await hydrateSession();
  },
  addMinutes: (translation = 0, connect = 0) =>
    set((state) => ({
      balances: {
        translationTotal: state.balances.translationTotal + translation,
        translationRemaining: state.balances.translationRemaining + translation,
        connectTotal: state.balances.connectTotal + connect,
        connectRemaining: state.balances.connectRemaining + connect,
      },
    })),
  hydrateSession: async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      set({ isAuthenticated: false, authReady: true });
      return;
    }
    const userId = session.user.id;
    const [{ data: profile }, { data: settings }, { data: balance }, { data: translations }, { data: subscription }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('usage_balances').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('translations').select('*').eq('user_id', userId).order('created_at', { ascending: false }),
      supabase.from('subscriptions').select('plan_id').eq('user_id', userId).eq('status', 'active').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const planId = subscription?.plan_id ?? profile?.plan_id ?? 'free';
    set({
      isAuthenticated: true,
      authReady: true,
      user: {
        id: userId,
        name: profile?.name ?? session.user.user_metadata?.name ?? 'User',
        email: session.user.email ?? '',
        avatar: profile?.avatar ?? 'U',
        planId,
        phone: profile?.phone ?? undefined,
        country: profile?.country ?? undefined,
        primaryLanguage: profile?.primary_language ?? undefined,
      },
      selectedPlanId: planId,
      sourceLanguage: settings?.default_source_language ?? profile?.primary_language ?? 'English',
      targetLanguage: settings?.default_target_language ?? 'Português',
      autoDetect: settings?.auto_detect ?? true,
      detectedLanguage: settings?.auto_detect ? (profile?.primary_language ?? 'English') : null,
      userSettings: settings ? {
        theme: settings.theme,
        autoDetect: settings.auto_detect,
        defaultSourceLanguage: settings.default_source_language,
        defaultTargetLanguage: settings.default_target_language,
        voicePlayback: settings.voice_playback,
        playbackSpeed: settings.playback_speed,
        connectAutoStartMic: settings.connect_auto_start_mic,
        speakerOutput: settings.speaker_output,
        notifications: { usageAlerts: settings.usage_alerts, subscriptionAlerts: settings.subscription_alerts, productUpdates: settings.product_updates },
      } : undefined,
      balances: balance ? { translationTotal: balance.translation_total, translationRemaining: balance.translation_remaining, connectTotal: balance.connect_total, connectRemaining: balance.connect_remaining } : undefined,
      history: (translations ?? []).map((item) => ({ id: item.id, date: new Date(item.created_at).toLocaleDateString(), sourceLanguage: item.source_language, targetLanguage: item.target_language, originalText: item.original_text, translatedText: item.translated_text, mode: item.mode, duration: `${Math.ceil(item.duration_seconds / 60)} min` })),
    });
  },
}));

export const allPlans = plans;
