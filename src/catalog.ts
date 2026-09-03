import { LanguageOption, Plan } from './types';

export const supportedLanguages: LanguageOption[] = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇬🇧', popular: true },
  { code: 'pt', label: 'Portuguese', nativeLabel: 'Portuguese', flag: '🇵🇹', popular: true },
  { code: 'es', label: 'Spanish', nativeLabel: 'Spanish', flag: '🇪🇸', popular: true },
  { code: 'fr', label: 'French', nativeLabel: 'French', flag: '🇫🇷', popular: true },
  { code: 'de', label: 'German', nativeLabel: 'German', flag: '🇩🇪' },
  { code: 'it', label: 'Italian', nativeLabel: 'Italian', flag: '🇮🇹' },
  { code: 'zh', label: 'Chinese', nativeLabel: 'Chinese', flag: '🇨🇳' },
  { code: 'ja', label: 'Japanese', nativeLabel: 'Japanese', flag: '🇯🇵' },
  { code: 'ko', label: 'Korean', nativeLabel: 'Korean', flag: '🇰🇷' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'Arabic', flag: '🇸🇦' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'Hindi', flag: '🇮🇳' },
  { code: 'ru', label: 'Russian', nativeLabel: 'Russian', flag: '🇷🇺' },
];

export const plans: Plan[] = [
  { id: 'free', name: 'FREE', price: 0, currency: '$', billingCycle: 'month', translationMinutes: 10, connectMinutes: 0, features: ['10 Translation Minutes', 'English', 'French', 'Voice Translation', 'Text Translation'], tier: 'Essential' },
  { id: 'starter', name: 'STARTER', price: 9.99, currency: '$', billingCycle: 'month', translationMinutes: 30, connectMinutes: 10, features: ['30 Translation Minutes', '10 Connect Minutes', 'All supported languages', 'Translation history'], tier: 'Core' },
  { id: 'plus', name: 'PLUS', price: 19.99, currency: '$', billingCycle: 'month', translationMinutes: 75, connectMinutes: 25, features: ['75 Translation Minutes', '25 Connect Minutes', 'Priority processing', 'Full history'], popular: true, tier: 'Popular' },
  { id: 'pro', name: 'PRO', price: 34.99, currency: '$', billingCycle: 'month', translationMinutes: 150, connectMinutes: 50, features: ['150 Translation Minutes', '50 Connect Minutes', 'Advanced voice', 'Export'], tier: 'Pro' },
  { id: 'ultra', name: 'ULTRA', price: 59.99, currency: '$', billingCycle: 'month', translationMinutes: 300, connectMinutes: 100, features: ['300 Translation Minutes', '100 Connect Minutes', 'Highest priority', 'All premium features'], tier: 'Ultra' },
];
