export type LanguageCode =
  | 'en'
  | 'pt'
  | 'es'
  | 'fr'
  | 'de'
  | 'it'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'ar'
  | 'hi'
  | 'ru';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar: string;
  planId: string;
  phone?: string;
  country?: string;
  primaryLanguage?: string;
}

export interface Plan {
  id: string;
  name: string;
  price: number;
  currency: string;
  billingCycle: string;
  translationMinutes: number;
  connectMinutes: number;
  features: string[];
  popular?: boolean;
  tier: string;
}

export interface MinuteBalance {
  translationTotal: number;
  translationRemaining: number;
  connectTotal: number;
  connectRemaining: number;
}

export type MinuteType = 'translation' | 'connect';
export type MinuteTransactionType = 'grant' | 'purchase' | 'reservation' | 'consumption' | 'release' | 'lock' | 'unlock';

export interface MinuteTransaction {
  id: string;
  userId: string;
  minuteType: MinuteType;
  transactionType: MinuteTransactionType;
  minutes: number;
  referenceType?: string;
  referenceId?: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: 'active' | 'canceled' | 'past_due';
  startedAt: string;
  endsAt?: string;
}

export interface TranslationRecord extends TranslationHistoryItem {
  audioAvailable: boolean;
  createdAt: string;
}

export interface TranslationHistoryItem {
  id: string;
  date: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalText: string;
  translatedText: string;
  mode: 'translation' | 'connect';
  duration: string;
}

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  nativeLabel: string;
  flag: string;
  popular?: boolean;
}

export interface TranslationState {
  sourceLanguage: string;
  targetLanguage: string;
  autoDetect: boolean;
  detectedLanguage: string | null;
  originalText: string;
  translatedText: string;
  isListening: boolean;
  isProcessing: boolean;
  isPlaying: boolean;
  hasResult: boolean;
}

export interface ConnectSession {
  id: string;
  participantA: string;
  participantB: string;
  status: 'setup' | 'active' | 'complete';
  duration: string;
  messages: Array<{
    id: string;
    speaker: string;
    sourceLanguage: string;
    targetLanguage: string;
    text: string;
    translatedText: string;
    timestamp: string;
  }>;
}

export type ConnectSessionStatus = 'waiting' | 'paired' | 'ready' | 'inviting' | 'active' | 'paused' | 'reconnecting' | 'declined' | 'ended' | 'expired' | 'cancelled';

export interface ConnectParticipant {
  id: string;
  sessionId: string;
  userId: string;
  role: 'host' | 'connector';
  language: string;
  ready: boolean;
  joinedAt: string;
}

export interface ConnectInvitation {
  id: string;
  sessionId: string;
  hostUserId: string;
  connectorUserId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  expiresAt: string;
}

export interface ConnectConversationEvent {
  id: string;
  sessionId: string;
  speakerUserId: string;
  listenerUserId: string;
  sourceLanguage: string;
  targetLanguage: string;
  originalTranscript: string;
  translatedText: string;
  createdAt: string;
  processingDurationMs?: number;
}

export interface LiveKitRoomInfo {
  serverUrl: string;
  roomName: string;
  token: string;
  expiresAt: string;
}

export type RealtimeConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'error';
export type AudioPipelineState = 'idle' | 'listening' | 'processing' | 'playing' | 'error';

export interface NotificationSettings {
  usageAlerts: boolean;
  subscriptionAlerts: boolean;
  productUpdates: boolean;
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  autoDetect: boolean;
  defaultSourceLanguage: string;
  defaultTargetLanguage: string;
  voicePlayback: boolean;
  playbackSpeed: string;
  connectAutoStartMic: boolean;
  speakerOutput: boolean;
  notifications: NotificationSettings;
}
