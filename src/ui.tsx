import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet, SafeAreaView, TextInput, Image, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { CameraView, useCameraPermissions } from 'expo-camera';
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from './store';
import { theme } from './theme';
import { supportedLanguages, plans } from './catalog';
import { countries, CountryOption } from './countries';
import { supabase } from './supabase';
import { translationService } from './services/translation';
import { connectService } from './services/connect';

WebBrowser.maybeCompleteAuthSession();

export function ScreenShell({ children, padding = true }: { children: React.ReactNode; padding?: boolean }) {
  return (
    <SafeAreaView style={[styles.safeArea, { paddingHorizontal: padding ? theme.spacing.lg : 0 }]}>
      {children}
    </SafeAreaView>
  );
}

export function PrimaryButton({ title, onPress, fullWidth = false, style }: { title: string; onPress?: () => void; fullWidth?: boolean; style?: any }) {
  return (
    <Pressable onPress={onPress} style={[styles.primaryButton, fullWidth && styles.fullWidth, style]}>
      <Text style={styles.primaryButtonText}>{title}</Text>
    </Pressable>
  );
}

export function SecondaryButton({ title, onPress, style }: { title: string; onPress?: () => void; style?: any }) {
  return (
    <Pressable onPress={onPress} style={[styles.secondaryButton, style]}>
      <Text style={styles.secondaryButtonText}>{title}</Text>
    </Pressable>
  );
}

function AuthButton({ icon, title, onPress, dark = false }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; onPress: () => void; dark?: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.authButton, dark && styles.authButtonDark]}>
      <Ionicons name={icon} size={21} color={dark ? '#111111' : icon === 'logo-google' ? '#4285F4' : theme.colors.primaryText} />
      <Text style={[styles.authButtonText, dark && styles.authButtonTextDark]}>{title}</Text>
    </Pressable>
  );
}

function BrandMark({ size = 34 }: { size?: number }) {
  return <Image source={require('../assets/muwoyo-brand.png')} style={{ width: size, height: size }} resizeMode="contain" />;
}

function languageFlag(language: string) {
  return supportedLanguages.find((item) => item.label === language)?.flag ?? '🌐';
}

export function TopBar({ title, rightAction }: { title: string; rightAction?: React.ReactNode }) {
  const router = useRouter();
  return (
    <View style={styles.topBar}>
      <Pressable onPress={() => router.back()} style={styles.iconButton}>
        <Ionicons name="chevron-back" size={22} color={theme.colors.primaryText} />
      </Pressable>
      <View style={styles.topBarTitle}>
        <BrandMark size={44} />
        <Text style={styles.topBarTitleText}>{title}</Text>
      </View>
      <View style={styles.rightAction}>{rightAction}</View>
    </View>
  );
}

export function SplashScreen() {
  const router = useRouter();
  React.useEffect(() => {
    const timer = setTimeout(() => router.replace('/onboarding'), 1400);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ScreenShell padding={false}>
      <View style={styles.centeredSplash}>
        <Image source={require('../assets/muwoyo-brand.png')} style={styles.brandLogo} resizeMode="contain" />
        <Text style={styles.appName}>MUWOYO TRANSLATE</Text>
        <Text style={styles.tagline}>Translate without limits.</Text>
      </View>
    </ScreenShell>
  );
}

export function OnboardingScreen() {
  const router = useRouter();
  const slides = [
    { title: 'Speak. Translate. Understand.', description: 'Break language barriers with fast and natural translation.' },
    { title: 'Have conversations in any language.', description: 'Connect two people and translate the conversation in real time.' },
    { title: 'Your voice. Their language.', description: 'Speak naturally and let Muwoyo Translate handle the language barrier.' },
  ];
  const [index, setIndex] = React.useState(0);
  const slide = slides[index];

  return (
    <ScreenShell>
      <View style={styles.onboardingCard}>
        <Image source={require('../assets/muwoyo-brand.png')} style={styles.onboardingLogo} resizeMode="contain" />
        <Text style={styles.onboardingTitle}>{slide.title}</Text>
        <Text style={styles.onboardingText}>{slide.description}</Text>
        <View style={styles.dotsRow}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>
      </View>
      <View style={styles.buttonStack}>
        {index < slides.length - 1 ? (
          <PrimaryButton title="Next" fullWidth onPress={() => setIndex((v) => v + 1)} />
        ) : (
          <PrimaryButton title="Get Started" fullWidth onPress={() => router.push('/welcome')} />
        )}
        <SecondaryButton title="Already have an account? Sign In" onPress={() => router.push('/welcome')} />
      </View>
    </ScreenShell>
  );
}

export function WelcomeScreen() {
  const router = useRouter();
  const { setAuthState, setOnboardingComplete } = useAppStore();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [authError, setAuthError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [appLanguage, setAppLanguage] = React.useState<'pt' | 'en'>('pt');

  const completeAuth = () => {
    setAuthState(true);
    setOnboardingComplete(true);
    router.push('/(tabs)/translate');
  };

  const continueWithProvider = async (provider: 'google' | 'apple') => {
    setAuthError('');
    setIsLoading(true);
    const redirectTo = makeRedirectUri({ scheme: 'muwoyotranslate' });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error || !data.url) {
      setAuthError(error?.message ?? 'Unable to start sign in.');
      setIsLoading(false);
      return;
    }
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type === 'success') {
      const callbackUrl = new URL(result.url);
      const code = callbackUrl.searchParams.get('code');
      if (code) await supabase.auth.exchangeCodeForSession(code);
      completeAuth();
    }
    setIsLoading(false);
  };

  const continueWithEmail = async (createAccount = false) => {
    setAuthError('');
    setIsLoading(true);
    const response = createAccount
      ? await supabase.auth.signUp({ email: email.trim(), password })
      : await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (response.error) setAuthError(response.error.message);
    else completeAuth();
    setIsLoading(false);
  };

  return (
    <ScreenShell>
      <View style={styles.authLanguageRow}><Text style={styles.authLanguageLabel}>{appLanguage === 'pt' ? 'Idioma do app' : 'App language'}</Text><Pressable style={styles.languageSwitch} onPress={() => setAppLanguage((value) => value === 'pt' ? 'en' : 'pt')}><Text style={styles.languageSwitchText}>{appLanguage.toUpperCase()}</Text><Ionicons name="language-outline" size={18} color={theme.colors.emeraldDark} /></Pressable></View>
      <View style={styles.heroBlock}>
        <Text style={styles.title}>{appLanguage === 'pt' ? 'Bem-vindo' : 'Welcome'}</Text>
        <Text style={styles.subtitle}>{appLanguage === 'pt' ? 'Entre na sua próxima conversa multilíngue.' : 'Continue to your next multilingual conversation.'}</Text>
      </View>
      <View style={styles.buttonStack}>
        <AuthButton icon="logo-google" title={isLoading ? 'A conectar...' : 'Continuar com Google'} onPress={() => continueWithProvider('google')} />
        <AuthButton icon="logo-apple" title="Continuar com Apple" onPress={() => continueWithProvider('apple')} dark />
        <TextInput value={email} onChangeText={setEmail} placeholder="E-mail" placeholderTextColor={theme.colors.secondaryText} autoCapitalize="none" keyboardType="email-address" style={styles.authInput} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Palavra-passe" placeholderTextColor={theme.colors.secondaryText} secureTextEntry style={styles.authInput} />
        <AuthButton icon="log-in-outline" title="Entrar com e-mail" onPress={() => continueWithEmail()} />
        <SecondaryButton title="Criar conta" onPress={() => router.push('/create-account')} />
        {authError ? <Text style={styles.authError}>{authError}</Text> : null}
      </View>
    </ScreenShell>
  );
}

export function TranslateHomeScreen() {
  const router = useRouter();
  const { user, sourceLanguage, targetLanguage, autoDetect, detectedLanguage, swapLanguages, balances } = useAppStore();

  return (
    <ScreenShell>
      <View style={styles.translateHeaderRow}>
        <View style={styles.headerIdentity}>
          <BrandMark size={76} />
          <View>
            <Text style={styles.greeting}>Good afternoon</Text>
            <Text style={styles.name}>{user.name}</Text>
          </View>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarLetter}>{user.avatar}</Text></View>
      </View>
      <View style={styles.minuteBanner}>
        <Text style={styles.minuteLabel}>{balances.translationRemaining} Translation min</Text>
        <Pressable style={styles.plusButton} onPress={() => router.push('/subscription')}><Ionicons name="add" size={18} color={theme.colors.primaryText} /></Pressable>
      </View>

      <View style={styles.langSelectorCard}>
        <Pressable onPress={() => router.push('/language-selector?field=source')} style={styles.languagePill}>
          <Text style={styles.languageValue}>{autoDetect ? '🌐 Auto Detect' : `${languageFlag(sourceLanguage)} ${sourceLanguage}`}</Text>
        </Pressable>
        <Pressable onPress={swapLanguages} style={styles.swapButton}><Ionicons name="swap-horizontal" size={24} color={theme.colors.primaryText} /></Pressable>
        <Pressable onPress={() => router.push('/language-selector?field=target')} style={styles.languagePill}>
          <Text style={styles.languageValue}>{languageFlag(targetLanguage)} {targetLanguage}</Text>
        </Pressable>
      </View>

      <View style={styles.voiceDirections}>
        <Pressable onPress={() => router.push({ pathname: '/text-translation', params: { source: sourceLanguage, target: targetLanguage, voice: 'true' } })} style={styles.voiceDirection}>
          <Ionicons name="mic" size={34} color={theme.colors.white} />
          <Text style={styles.voiceDirectionLabel}>{languageFlag(sourceLanguage)} {sourceLanguage}</Text>
          <Text style={styles.voiceDirectionHint}>Falar para {targetLanguage}</Text>
        </Pressable>
        <Pressable onPress={() => router.push({ pathname: '/text-translation', params: { source: targetLanguage, target: sourceLanguage, voice: 'true' } })} style={[styles.voiceDirection, styles.voiceDirectionSecondary]}>
          <Ionicons name="mic" size={34} color={theme.colors.emeraldDark} />
          <Text style={styles.voiceDirectionLabel}>{languageFlag(targetLanguage)} {targetLanguage}</Text>
          <Text style={styles.voiceDirectionHint}>Falar para {sourceLanguage}</Text>
        </Pressable>
      </View>
      <Text style={styles.tapText}>Escolha um microfone</Text>
      <Text style={styles.helperText}>{sourceLanguage} → {targetLanguage}</Text>
      <View style={styles.rowBetween}><SecondaryButton title="Type instead" onPress={() => router.push('/text-translation')} style={{ flex: 1 }} /></View>
      {autoDetect && detectedLanguage ? <Text style={styles.detectedTag}>Detected: {detectedLanguage}</Text> : null}
    </ScreenShell>
  );
}

export function CreateAccountScreen() {
  const router = useRouter();
  const [step, setStep] = React.useState<1 | 2 | 3>(1);
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [country, setCountry] = React.useState<CountryOption | null>(null);
  const [countryCode, setCountryCode] = React.useState<CountryOption | null>(countries.find((item) => item.code === 'PT') ?? countries[0]);
  const [primaryLanguage, setPrimaryLanguage] = React.useState('');
  const [translationLanguage, setTranslationLanguage] = React.useState('');
  const [picker, setPicker] = React.useState<'country' | 'code' | null>(null);
  const [countrySearch, setCountrySearch] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const { setAuthState, setOnboardingComplete } = useAppStore();

  const createAccount = async () => {
    setMessage('');
    if (!country || !primaryLanguage || !translationLanguage) {
      setMessage('Choose your country, main language, and translation language.');
      return;
    }
    setIsLoading(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { name: name.trim(), full_name: name.trim(), phone: `${countryCode?.callingCode ?? ''}${phone.trim()}`, country: country?.name, primary_language: primaryLanguage, translation_language: translationLanguage } } });
    if (error) setMessage(error.message);
    else if (!data.session) router.replace('/email-confirmation');
    else {
      setAuthState(true);
      setOnboardingComplete(true);
      router.replace('/(tabs)/translate');
    }
    setIsLoading(false);
  };

  return (
    <ScreenShell>
      <TopBar title="Create account" />
      <Text style={styles.stepLabel}>Step {step} of 3</Text>
      {step === 1 ? <View style={styles.authForm}>
        <Text style={styles.title}>Your details</Text>
        <Text style={styles.subtitle}>Set up your profile and where you are from.</Text>
        <TextInput value={name} onChangeText={setName} placeholder="Full name" placeholderTextColor={theme.colors.secondaryText} style={styles.authInput} />
        <TextInput value={email} onChangeText={setEmail} placeholder="Email address" placeholderTextColor={theme.colors.secondaryText} autoCapitalize="none" keyboardType="email-address" style={styles.authInput} />
        <View style={styles.phoneRow}><Pressable style={styles.countryCode} onPress={() => setPicker('code')}><Text style={styles.countryCodeText}>{countryCode?.flag} {countryCode?.callingCode}</Text></Pressable><TextInput value={phone} onChangeText={setPhone} placeholder="Phone number" placeholderTextColor={theme.colors.secondaryText} keyboardType="phone-pad" style={[styles.authInput, styles.phoneInput]} /></View>
        <Pressable style={styles.selectInput} onPress={() => setPicker('country')}><Text style={country ? styles.selectValue : styles.selectPlaceholder}>{country ? `${country.flag} ${country.name}` : 'Country of residence'}</Text><Ionicons name="chevron-down" size={18} color={theme.colors.secondaryText} /></Pressable>
        <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={theme.colors.secondaryText} secureTextEntry style={styles.authInput} />
        <PrimaryButton title="Continue" fullWidth onPress={() => { if (!name.trim() || !email.trim() || !phone.trim() || !country || password.length < 6) setMessage('Complete all fields and use a password with 6+ characters.'); else { setMessage(''); setStep(2); } }} />
      </View> : step === 2 ? <View style={styles.authForm}>
        <Text style={styles.title}>Your languages</Text>
        <Text style={styles.subtitle}>Choose the language you use and the one you translate most often.</Text>
        <Text style={styles.fieldLabel}>Main language</Text>
        <ScrollView style={styles.languageChoiceList}>{countries.map((item) => <Pressable key={item.code} style={[styles.languageChoice, primaryLanguage === item.name && styles.languageChoiceActive]} onPress={() => setPrimaryLanguage(item.name)}><Text style={styles.languageFlag}>{item.flag}</Text><Text style={styles.languageRowText}>{item.name}</Text><Text style={styles.languageNative}>Primary language</Text></Pressable>)}</ScrollView>
        <PrimaryButton title="Continue" fullWidth onPress={() => { if (!primaryLanguage) setMessage('Choose your main language.'); else { setMessage(''); setStep(3); } }} />
        <SecondaryButton title="Back" onPress={() => setStep(1)} />
      </View> : <View style={styles.authForm}>
        <Text style={styles.title}>Preferred translation language</Text>
        <Text style={styles.subtitle}>Choose the default language for your translations.</Text>
        <ScrollView style={styles.languageChoiceList}>{countries.map((item) => <Pressable key={item.code} style={[styles.languageChoice, translationLanguage === item.name && styles.languageChoiceActive]} onPress={() => setTranslationLanguage(item.name)}><Text style={styles.languageFlag}>{item.flag}</Text><Text style={styles.languageRowText}>{item.name}</Text><Text style={styles.languageNative}>Translation language</Text></Pressable>)}</ScrollView>
        <PrimaryButton title={isLoading ? 'Creating...' : 'Create account'} fullWidth onPress={createAccount} />
        <SecondaryButton title="Back" onPress={() => setStep(2)} />
      </View>}
      {message ? <Text style={styles.authError}>{message}</Text> : null}
      <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}><View style={styles.modalBackdrop}><View style={styles.countryModal}><Text style={styles.title}>{picker === 'code' ? 'Country code' : 'Country of residence'}</Text><TextInput value={countrySearch} onChangeText={setCountrySearch} placeholder="Search in English" placeholderTextColor={theme.colors.secondaryText} style={styles.authInput} /><ScrollView>{countries.filter((item) => item.name.toLowerCase().includes(countrySearch.toLowerCase())).map((item) => <Pressable key={item.code} style={styles.countryOption} onPress={() => { if (picker === 'code') setCountryCode(item); else setCountry(item); setPicker(null); setCountrySearch(''); }}><Text style={styles.languageFlag}>{item.flag}</Text><Text style={styles.languageRowText}>{picker === 'code' ? `${item.name} (${item.callingCode})` : item.name}</Text></Pressable>)}</ScrollView><SecondaryButton title="Cancel" onPress={() => setPicker(null)} /></View></View></Modal>
    </ScreenShell>
  );
}

export function EmailConfirmationScreen() {
  const router = useRouter();
  return (
    <ScreenShell>
      <View style={styles.confirmationCard}>
        <Ionicons name="mail-open-outline" size={64} color={theme.colors.emerald} />
        <Text style={styles.title}>Confirme o seu e-mail</Text>
        <Text style={styles.subtitle}>Enviámos um link de confirmação para o seu endereço de e-mail. Abra-o para ativar a conta.</Text>
      </View>
      <PrimaryButton title="Já confirmei o meu e-mail" fullWidth onPress={() => router.replace('/welcome')} />
      <SecondaryButton title="Voltar ao login" onPress={() => router.replace('/welcome')} />
    </ScreenShell>
  );
}

export function LanguageSelectorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ field?: string }>();
  const { setSourceLanguage, setTargetLanguage, swapLanguages, setAutoDetect } = useAppStore();
  const field = Array.isArray(params.field) ? params.field[0] : params.field ?? 'source';

  const handleSelectLanguage = (langLabel: string) => {
    if (field === 'source') {
      setSourceLanguage(langLabel);
      setAutoDetect(false);
    } else if (field === 'target') {
      setTargetLanguage(langLabel);
    } else if (field === 'swap') {
      swapLanguages();
    }
    router.back();
  };

  return (
    <ScreenShell>
      <TopBar title="Language" />
      <View style={styles.searchBox}><Ionicons name="search" size={18} color={theme.colors.secondaryText} /><Text style={styles.searchText}>Search languages</Text></View>
      <ScrollView style={{ marginTop: 16 }}>
        <Text style={styles.sectionTitle}>Popular</Text>
        {supportedLanguages.filter((lang) => lang.popular).map((lang) => (
          <Pressable
            key={lang.code}
            style={styles.languageRow}
            onPress={() => handleSelectLanguage(lang.label)}
          >
            <Text style={styles.languageFlag}>{lang.flag}</Text>
            <Text style={styles.languageRowText}>{lang.label}</Text>
            <Text style={styles.languageNative}>{lang.nativeLabel}</Text>
          </Pressable>
        ))}
        <SecondaryButton title="Auto Detect" onPress={() => { setAutoDetect(true); router.back(); }} style={{ marginTop: 20 }} />
      </ScrollView>
    </ScreenShell>
  );
}

export function TextTranslationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ source?: string; target?: string; voice?: string }>();
  const storeLanguages = useAppStore((state) => ({ sourceLanguage: state.sourceLanguage, targetLanguage: state.targetLanguage }));
  const sourceLanguage = (Array.isArray(params.source) ? params.source[0] : params.source) ?? storeLanguages.sourceLanguage;
  const targetLanguage = (Array.isArray(params.target) ? params.target[0] : params.target) ?? storeLanguages.targetLanguage;
  const [value, setValue] = React.useState('');
  const [isTranslating, setIsTranslating] = React.useState(false);
  const [error, setError] = React.useState('');
  const [translatedText, setTranslatedText] = React.useState('');
  const [languageField, setLanguageField] = React.useState<'source' | 'target' | null>(null);

  const handleTranslate = async () => {
    const original = value.trim();
    if (!original) return;
    setError('');
    setIsTranslating(true);
    try {
      const result = await translationService.translateText({ text: original, sourceLanguage, targetLanguage, autoDetect: false });
      setTranslatedText(result.translatedText);
    } catch (translationError) {
      setError(translationError instanceof Error ? translationError.message : 'A tradução falhou. Tente novamente.');
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <ScreenShell>
      <TopBar title="Translate" />
      <View style={styles.textLanguageRow}><Pressable onPress={() => setLanguageField('source')} style={styles.textLanguageSelector}><Text style={styles.languageValue}>{languageFlag(sourceLanguage)} {sourceLanguage}</Text></Pressable><Ionicons name="arrow-forward" size={20} color={theme.colors.muted} /><Pressable onPress={() => setLanguageField('target')} style={styles.textLanguageSelector}><Text style={styles.languageValue}>{languageFlag(targetLanguage)} {targetLanguage}</Text></Pressable></View>
      <View style={styles.translationInputCard}><Text style={styles.resultLabel}>Texto original</Text><TextInput multiline value={value} onChangeText={setValue} placeholder="Escreva algo para traduzir..." placeholderTextColor={theme.colors.secondaryText} style={styles.textInput} /><Pressable onPress={() => setValue('')} style={styles.clearInput}><Ionicons name="close-circle" size={22} color={theme.colors.muted} /></Pressable></View>
      <View style={styles.translationOutputCard}><Text style={styles.resultLabel}>Tradução</Text><Text style={styles.translationOutput}>{isTranslating ? 'A traduzir...' : translatedText || 'O resultado aparecerá aqui.'}</Text></View>
      <View style={styles.textActions}><Pressable style={styles.verticalAction}><Ionicons name="volume-high-outline" size={21} color={theme.colors.primaryText} /><Text style={styles.actionLabel}>Ouvir áudio</Text></Pressable><Pressable style={styles.verticalAction}><Ionicons name="copy-outline" size={21} color={theme.colors.primaryText} /><Text style={styles.actionLabel}>Copiar</Text></Pressable><Pressable style={styles.verticalAction}><Ionicons name="share-social-outline" size={21} color={theme.colors.primaryText} /><Text style={styles.actionLabel}>Partilhar</Text></Pressable><Pressable style={styles.verticalAction} onPress={() => { if (translatedText) void useAppStore.getState().saveTranslation({ sourceLanguage, targetLanguage, originalText: value, translatedText, mode: 'translation' }); }}><Ionicons name="heart-outline" size={21} color={theme.colors.primaryText} /><Text style={styles.actionLabel}>Favoritos</Text></Pressable></View>
      <PrimaryButton title={isTranslating ? 'A traduzir...' : 'Traduzir'} fullWidth onPress={handleTranslate} />
      {error ? <Text style={styles.authError}>{error}</Text> : null}
      <Modal visible={languageField !== null} animationType="slide" transparent onRequestClose={() => setLanguageField(null)}><View style={styles.modalBackdrop}><View style={styles.countryModal}><Text style={styles.title}>Escolher idioma</Text><ScrollView>{supportedLanguages.map((language) => <Pressable key={language.code} style={styles.countryOption} onPress={() => { if (languageField === 'source') useAppStore.getState().setSourceLanguage(language.label); else useAppStore.getState().setTargetLanguage(language.label); setLanguageField(null); }}><Text style={styles.languageFlag}>{language.flag}</Text><Text style={styles.languageRowText}>{language.label}</Text></Pressable>)}</ScrollView><SecondaryButton title="Cancelar" onPress={() => setLanguageField(null)} /></View></View></Modal>
    </ScreenShell>
  );
}

export function TranslationResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ original?: string; translated?: string }>();
  const { sourceLanguage, targetLanguage, saveTranslation } = useAppStore();
  const original = Array.isArray(params.original) ? params.original[0] : params.original ?? 'How much does this cost?';
  const translated = Array.isArray(params.translated) ? params.translated[0] : params.translated ?? 'Quanto custa isto?';
  const handleDone = async () => {
    await saveTranslation({ sourceLanguage, targetLanguage, originalText: original, translatedText: translated, mode: 'translation' });
    router.push('/(tabs)/translate');
  };

  return (
    <ScreenShell>
      <TopBar title="Translation" />
      <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>Original</Text>
        <Text style={styles.resultText}>{original}</Text>
        <Text style={styles.resultLabel}>Translation</Text>
        <Text style={styles.resultText}>{translated}</Text>
        <Text style={styles.resultLabel}>Languages</Text>
        <Text style={styles.resultText}>{sourceLanguage} → {targetLanguage}</Text>
      </View>
      <View style={styles.resultActions}>
        <Pressable style={styles.actionPill} onPress={() => router.back()}><Ionicons name="play" size={18} color={theme.colors.primaryText} /><Text style={styles.actionLabel}>Play</Text></Pressable>
        <Pressable style={styles.actionPill}><Ionicons name="copy" size={18} color={theme.colors.primaryText} /><Text style={styles.actionLabel}>Copy</Text></Pressable>
        <Pressable style={styles.actionPill}><Ionicons name="share-social" size={18} color={theme.colors.primaryText} /><Text style={styles.actionLabel}>Share</Text></Pressable>
      </View>
      <PrimaryButton title="Done" fullWidth onPress={handleDone} />
    </ScreenShell>
  );
}

export function ConnectSetupScreen() {
  const router = useRouter();
  const { sourceLanguage, targetLanguage } = useAppStore();
  const [mode, setMode] = React.useState<'choose' | 'host' | 'join'>('choose');
  const [pairingCode, setPairingCode] = React.useState('');
  const [invite, setInvite] = React.useState<{ sessionId: string; qrPayload: string; pairingCode: string; expiresAt: string } | null>(null);
  const [error, setError] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [sessionStatus, setSessionStatus] = React.useState<'waiting' | 'paired' | 'ready' | 'inviting' | 'active' | 'ended'>('waiting');

  const createSession = async () => {
    setIsLoading(true); setError('');
    try { const created = await connectService.createHostSession(sourceLanguage, targetLanguage); setInvite(created); setSessionStatus(created.status === 'waiting' ? 'waiting' : 'paired'); setMode('host'); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível criar a conversa.'); }
    finally { setIsLoading(false); }
  };

  const joinSession = async (code = pairingCode) => {
    setIsLoading(true); setError('');
    try { const joined = await connectService.joinWithCode(code); router.push({ pathname: '/connect-active', params: { sessionId: joined.sessionId } }); }
    catch (requestError) { setError(requestError instanceof Error ? requestError.message : 'Código inválido ou expirado.'); }
    finally { setIsLoading(false); }
  };

  React.useEffect(() => {
    if (!invite) return;
    return connectService.subscribe(invite.sessionId, (payload) => {
      const nextStatus = (payload as { new?: { status_v2?: typeof sessionStatus } }).new?.status_v2;
      if (nextStatus) setSessionStatus(nextStatus as typeof sessionStatus);
    });
  }, [invite]);

  if (mode === 'host' && invite) return <ScreenShell><TopBar title="Host Connect" /><View style={styles.connectInvite}><Text style={styles.title}>Invite someone to connect</Text><Text style={styles.subtitle}>Scan this code or share the pairing code.</Text><QRCode value={invite.qrPayload} size={210} backgroundColor={theme.colors.white} color={theme.colors.primaryText} /><Text style={styles.pairingCode}>{invite.pairingCode}</Text><View style={[styles.sessionStatus, sessionStatus !== 'waiting' && styles.sessionStatusReady]}><Ionicons name={sessionStatus === 'waiting' ? 'time-outline' : 'checkmark-circle-outline'} size={20} color={sessionStatus === 'waiting' ? theme.colors.warning : theme.colors.emeraldDark} /><Text style={styles.sessionStatusText}>{sessionStatus === 'waiting' ? 'Waiting for the Connector...' : 'Connector connected and ready.'}</Text></View>{sessionStatus === 'paired' || sessionStatus === 'ready' ? <PrimaryButton title="Start Conversation" fullWidth onPress={async () => { await connectService.updateStatus(invite.sessionId, 'inviting'); setSessionStatus('inviting'); }} /> : null}<SecondaryButton title="Cancel session" onPress={async () => { await connectService.cancelSession(invite.sessionId); setInvite(null); setMode('choose'); }} /></View></ScreenShell>;
  if (mode === 'join') return <ScreenShell><TopBar title="Join Connect" /><Text style={styles.title}>Join a conversation</Text><Text style={styles.subtitle}>Enter the code shared by the Host or scan the QR code.</Text><TextInput value={pairingCode} onChangeText={(value) => setPairingCode(value.toUpperCase())} placeholder="XXXX-XXXX" placeholderTextColor={theme.colors.secondaryText} autoCapitalize="characters" style={styles.pairingInput} /><PrimaryButton title={isLoading ? 'Connecting...' : 'Connect'} fullWidth onPress={() => joinSession()} /><SecondaryButton title="Scan QR" onPress={async () => { const permission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission(); if (permission?.granted) setScannerOpen(true); else setError('A câmara é necessária para ler o QR code.'); }} /><Modal visible={scannerOpen} animationType="slide"><CameraView style={styles.scanner} barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => { setScannerOpen(false); try { const payload = JSON.parse(data) as { sessionId?: string; pairingToken?: string }; if (payload.sessionId && payload.pairingToken) void connectService.joinWithQr(payload.sessionId, payload.pairingToken).then(() => router.push('/connect-active')).catch((requestError) => setError(requestError instanceof Error ? requestError.message : 'QR code inválido.')); else setError('QR code inválido.'); } catch { setError('QR code inválido.'); } }} /></Modal>{error ? <Text style={styles.authError}>{error}</Text> : null}</ScreenShell>;
  return (
    <ScreenShell>
      <TopBar title="Connect" />
      <Text style={styles.subtitle}>Talk naturally across languages.</Text>
      <View style={styles.roleCard}><Ionicons name="radio-outline" size={28} color={theme.colors.emeraldDark} /><Text style={styles.roleTitle}>Host</Text><Text style={styles.roleText}>Create a conversation and invite someone.</Text><PrimaryButton title="Host a Connect" fullWidth onPress={createSession} /></View>
      <View style={styles.roleCard}><Ionicons name="enter-outline" size={28} color={theme.colors.emeraldDark} /><Text style={styles.roleTitle}>Connector</Text><Text style={styles.roleText}>Join someone else's conversation.</Text><SecondaryButton title="Join Connect" onPress={() => setMode('join')} /></View>
      {error ? <Text style={styles.authError}>{error}</Text> : null}
    </ScreenShell>
  );
}

export function ConnectActiveScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const sessionId = Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId;
  const { user } = useAppStore();
  const [session, setSession] = React.useState<{ hostName: string; connectorName?: string; hostLanguage: string; connectorLanguage: string; status: string } | null>(null);
  const [connectionState, setConnectionState] = React.useState<'connecting' | 'connected' | 'error'>('connecting');
  const [isMuted, setIsMuted] = React.useState(false);
  const [speakerEnabled, setSpeakerEnabled] = React.useState(true);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (!sessionId) { setError('Sessão inválida.'); setConnectionState('error'); return; }
    let cancelled = false;
    void Promise.all([connectService.getSession(sessionId), connectService.getLiveKitToken(sessionId)]).then(([details]) => {
      if (!cancelled) { setSession(details); setConnectionState('connected'); }
    }).catch((requestError) => {
      if (!cancelled) { setError(requestError instanceof Error ? requestError.message : 'Não foi possível ligar à conversa.'); setConnectionState('error'); }
    });
    const unsubscribe = connectService.subscribe(sessionId, (payload) => {
      const status = (payload as { new?: { status_v2?: string } }).new?.status_v2;
      if (status === 'ended' || status === 'declined') router.replace('/connect-complete');
    });
    return () => { cancelled = true; unsubscribe(); };
  }, [sessionId, router]);

  const endSession = async () => {
    if (sessionId) await connectService.endSession(sessionId);
    router.replace('/connect-complete');
  };

  return (
    <ScreenShell>
      <TopBar title="Live Conversation" />
      <View style={styles.participantRow}>
        <View style={styles.participantCard}><Text style={styles.participantName}>{session?.hostName ?? user.name}</Text><Text style={styles.participantLanguage}>{languageFlag(session?.hostLanguage ?? 'English')} {session?.hostLanguage ?? 'English'}</Text></View>
        <View style={styles.participantCard}><Text style={styles.participantName}>{session?.connectorName ?? 'Connector'}</Text><Text style={styles.participantLanguage}>{languageFlag(session?.connectorLanguage ?? 'Portuguese')} {session?.connectorLanguage ?? 'Portuguese'}</Text></View>
      </View>
      <View style={styles.liveStatus}><View style={[styles.statusDot, connectionState === 'connected' && styles.statusDotLive]} /><Text style={styles.liveStatusText}>{connectionState === 'connecting' ? 'A ligar...' : connectionState === 'connected' ? 'Ligado e pronto' : error}</Text></View>
      <View style={styles.emptyTimeline}>
        <Ionicons name="chatbubbles-outline" size={34} color={theme.colors.muted} />
        <Text style={styles.emptyText}>A conversa traduzida aparecerá aqui.</Text>
      </View>
      <View style={styles.bottomControls}>
        <Pressable style={[styles.controlChip, isMuted && styles.controlChipActive]} onPress={() => setIsMuted((value) => !value)}><Ionicons name={isMuted ? 'mic-off' : 'mic'} size={18} color={theme.colors.primaryText} /></Pressable>
        <Pressable style={[styles.controlChip, !speakerEnabled && styles.controlChipActive]} onPress={() => setSpeakerEnabled((value) => !value)}><Ionicons name={speakerEnabled ? 'volume-high' : 'volume-mute'} size={18} color={theme.colors.primaryText} /></Pressable>
        <Pressable style={styles.controlChip}><Ionicons name="settings" size={18} color={theme.colors.primaryText} /></Pressable>
        <Pressable style={styles.controlChipEnd} onPress={endSession}><Ionicons name="call" size={18} color={theme.colors.white} /></Pressable>
      </View>
      <Text style={styles.remainingText}>Connect Minutes: server-authoritative</Text>
    </ScreenShell>
  );
}

export function ConnectCompleteScreen() {
  const router = useRouter();
  return (
    <ScreenShell>
      <View style={styles.completionCard}>
        <Text style={styles.title}>Conversation complete</Text>
        <Text style={styles.subtitle}>Duration: 18:42</Text>
        <Text style={styles.subtitle}>Languages: English → Portuguese</Text>
        <Text style={styles.subtitle}>Messages translated: 12</Text>
        <Text style={styles.subtitle}>Minutes used: 2</Text>
      </View>
      <View style={styles.buttonStack}>
        <PrimaryButton title="View Conversation" onPress={() => router.push('/history')} fullWidth />
        <SecondaryButton title="Start New Conversation" onPress={() => router.push('/(tabs)/connect')} />
      </View>
    </ScreenShell>
  );
}

export function HistoryScreen() {
  const { history } = useAppStore();
  const router = useRouter();
  const [filter, setFilter] = React.useState<'All' | 'Translation' | 'Connect'>('All');
  const visibleHistory = filter === 'All' ? history : history.filter((item) => item.mode === filter.toLowerCase());
  return (
    <ScreenShell>
      <TopBar title="History" rightAction={<Ionicons name="search" size={20} color={theme.colors.primaryText} />} />
      <View style={styles.filterRow}>
        {['All', 'Translation', 'Connect'].map((item) => (
          <Pressable key={item} onPress={() => setFilter(item as typeof filter)} style={[styles.filterPill, filter === item && styles.filterPillActive]}><Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text></Pressable>
        ))}
      </View>
      {visibleHistory.map((item) => (
          <Pressable key={item.id} style={styles.historyCard} onPress={() => router.push({ pathname: '/history-detail', params: { id: item.id } })}>
          <Text style={styles.historyLanguage}>{item.sourceLanguage} → {item.targetLanguage}</Text>
          <Text style={styles.historyPreview}>{item.originalText}</Text>
          <Text style={styles.historyMeta}>{item.date} · {item.duration}</Text>
        </Pressable>
      ))}
    </ScreenShell>
  );
}

export function HistoryDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const { history } = useAppStore();
  const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
  const item = history.find((entry) => entry.id === itemId);

  return (
    <ScreenShell>
      <TopBar title="History detail" />
      {item ? <View style={styles.resultCard}>
        <Text style={styles.resultLabel}>Source language</Text>
        <Text style={styles.resultText}>{item.sourceLanguage}</Text>
        <Text style={styles.resultLabel}>Translated language</Text>
        <Text style={styles.resultText}>{item.targetLanguage}</Text>
        <Text style={styles.resultLabel}>Original</Text>
        <Text style={styles.resultText}>{item.originalText}</Text>
        <Text style={styles.resultLabel}>Translation</Text>
        <Text style={styles.resultText}>{item.translatedText}</Text>
      </View> : <Text style={styles.emptyText}>This translation is no longer available.</Text>}
    </ScreenShell>
  );
}

export function ProfileScreen() {
  const router = useRouter();
  const { user, selectedPlanId, setAuthState } = useAppStore();
  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthState(false);
    router.replace('/welcome');
  };

  const openProfileItem = (item: string) => {
    if (item === 'Subscription') router.push('/subscription');
    else if (item === 'Usage') router.push('/usage');
    else if (item === 'Languages') router.push('/language-selector?field=source');
    else if (item === 'Voice' || item === 'Notifications' || item === 'Appearance' || item === 'Privacy') router.push('/settings');
    else if (item === 'Sign Out') signOut();
    else router.push('/settings');
  };

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={styles.profileScroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileHeader}>
          <Image source={require('../assets/muwoyo-brand.png')} style={styles.profileLogo} resizeMode="contain" />
          <View style={styles.avatarLarge}><Image source={require('../assets/muwoyo-brand.png')} style={styles.avatarLogo} resizeMode="contain" /></View>
          <Text style={styles.title}>{user.name}</Text>
          <Text style={styles.subtitle}>{user.email}</Text>
          <Text style={styles.planTag}>{selectedPlanId.toUpperCase()}</Text>
        </View>
        <View style={styles.settingsList}>
          {['Account', 'Subscription', 'Usage', 'Languages', 'Voice', 'Notifications', 'Appearance', 'Privacy', 'Help', 'About', 'Sign Out'].map((item) => (
            <Pressable key={item} style={[styles.settingsRow, item === 'Sign Out' && styles.signOutRow]} onPress={() => openProfileItem(item)}>
              <Text style={[styles.settingsText, item === 'Sign Out' && styles.signOutText]}>{item}</Text>
              <Ionicons name="chevron-forward" size={18} color={item === 'Sign Out' ? theme.colors.error : theme.colors.secondaryText} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ScreenShell>
  );
}

export function UsageScreen() {
  const { balances } = useAppStore();
  const totalTranslation = 75;
  const totalConnect = 25;
  return (
    <ScreenShell>
      <TopBar title="Usage" />
      <Text style={styles.sectionTitle}>This month's usage</Text>
      <View style={styles.usageCard}>
        <Text style={styles.usageLabel}>Translation</Text>
        <Text style={styles.usageValue}>{balances.translationRemaining} / {totalTranslation} minutes</Text>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${(balances.translationRemaining / totalTranslation) * 100}%` }]} /></View>
      </View>
      <View style={styles.usageCard}>
        <Text style={styles.usageLabel}>Connect</Text>
        <Text style={styles.usageValue}>{balances.connectRemaining} / {totalConnect} minutes</Text>
        <View style={styles.progressBar}><View style={[styles.progressFill, { width: `${(balances.connectRemaining / totalConnect) * 100}%` }]} /></View>
      </View>
      <Text style={styles.subtitle}>Resets October 2</Text>
    </ScreenShell>
  );
}

export function SubscriptionScreen() {
  const router = useRouter();
  const { selectedPlanId, setSelectedPlan } = useAppStore();
  return (
    <ScreenShell>
      <TopBar title="Plans" />
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {plans.map((plan) => (
          <View key={plan.id} style={[styles.planCard, plan.id === 'plus' && styles.planPopular]}>
            {plan.popular ? <Text style={styles.badge}>MOST POPULAR</Text> : null}
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>${plan.price.toFixed(2)}<Text style={styles.planPeriod}>/month</Text></Text>
            <Text style={styles.planMeta}>{plan.translationMinutes} Translation Minutes</Text>
            <Text style={styles.planMeta}>{plan.connectMinutes} Connect Minutes</Text>
            {plan.features.map((feature) => <Text key={feature} style={styles.featureText}>• {feature}</Text>)}
            <PrimaryButton title={plan.id === selectedPlanId ? 'Current Plan' : 'Choose Plan'} fullWidth onPress={() => { setSelectedPlan(plan.id); router.push('/checkout'); }} />
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

export function CheckoutScreen() {
  const router = useRouter();
  const { selectedPlanId } = useAppStore();
  const selectedPlan = plans.find((plan) => plan.id === selectedPlanId) ?? plans[2];
  return (
    <ScreenShell>
      <TopBar title="Checkout" />
      <View style={styles.checkoutCard}>
        <Text style={styles.checkoutTitle}>{selectedPlan.name}</Text>
        <Text style={styles.checkoutPrice}>{selectedPlan.currency}{selectedPlan.price.toFixed(2)} / {selectedPlan.billingCycle}</Text>
        <Text style={styles.checkoutText}>Payment method: Visa •••• 1248</Text>
        <Text style={styles.checkoutText}>Total: {selectedPlan.currency}{selectedPlan.price.toFixed(2)}</Text>
      </View>
      <PrimaryButton title="Subscribe" fullWidth onPress={() => router.push('/payment-success')} />
      <SecondaryButton title="Cancel" onPress={() => router.push('/subscription')} />
    </ScreenShell>
  );
}

export function PaymentSuccessScreen() {
  const router = useRouter();
  return (
    <ScreenShell>
      <View style={styles.successCard}>
        <Ionicons name="checkmark-circle" size={80} color={theme.colors.emerald} />
        <Text style={styles.title}>You're all set.</Text>
        <Text style={styles.subtitle}>Your Plus plan is now active.</Text>
        <Text style={styles.subtitle}>Translation Minutes: 75</Text>
        <Text style={styles.subtitle}>Connect Minutes: 25</Text>
      </View>
      <PrimaryButton title="Start Translating" fullWidth onPress={() => router.push('/(tabs)/translate')} />
    </ScreenShell>
  );
}

export function SettingsScreen() {
  const { userSettings, setTheme, setAutoDetect } = useAppStore();
  const [voicePlayback, setVoicePlayback] = React.useState(userSettings.voicePlayback);
  const [notifications, setNotifications] = React.useState(userSettings.notifications.usageAlerts);

  return (
    <ScreenShell>
      <TopBar title="Settings" />
      <View style={styles.settingsList}>
        <Pressable style={styles.settingsRow} onPress={() => setTheme(userSettings.theme === 'dark' ? 'light' : 'dark')}>
          <Text style={styles.settingsText}>Appearance</Text>
          <Text style={styles.settingValue}>{userSettings.theme === 'dark' ? 'Dark' : 'Light'}</Text>
        </Pressable>
        <Pressable style={styles.settingsRow} onPress={() => setAutoDetect(!userSettings.autoDetect)}>
          <Text style={styles.settingsText}>Auto-detect language</Text>
          <Text style={styles.settingValue}>{userSettings.autoDetect ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.settingsRow} onPress={() => setVoicePlayback((value) => !value)}>
          <Text style={styles.settingsText}>Voice playback</Text>
          <Text style={styles.settingValue}>{voicePlayback ? 'On' : 'Off'}</Text>
        </Pressable>
        <Pressable style={styles.settingsRow} onPress={() => setNotifications((value) => !value)}>
          <Text style={styles.settingsText}>Usage notifications</Text>
          <Text style={styles.settingValue}>{notifications ? 'On' : 'Off'}</Text>
        </Pressable>
        {['General', 'Language', 'Sound', 'Translation', 'Connect', 'Privacy', 'Support'].map((item) => (
          <Pressable key={item} style={styles.settingsRow}>
            <Text style={styles.settingsText}>{item}</Text>
            <Ionicons name="chevron-forward" size={18} color={theme.colors.secondaryText} />
          </Pressable>
        ))}
      </View>
    </ScreenShell>
  );
}

export function PermissionsScreen() {
  const router = useRouter();
  return (
    <ScreenShell>
      <View style={styles.permissionCard}>
        <Ionicons name="mic" size={54} color={theme.colors.emerald} />
        <Text style={styles.title}>Microphone access</Text>
        <Text style={styles.subtitle}>We need access to your microphone to translate your voice.</Text>
      </View>
      <PrimaryButton title="Allow Microphone" fullWidth onPress={() => router.push('/(tabs)/translate')} />
      <SecondaryButton title="Not Now" onPress={() => router.push('/(tabs)/translate')} />
    </ScreenShell>
  );
}

export function ErrorScreen() {
  const router = useRouter();
  return (
    <ScreenShell>
      <View style={styles.errorCard}>
        <Ionicons name="alert-circle" size={64} color={theme.colors.error} />
        <Text style={styles.title}>Something went wrong.</Text>
        <Text style={styles.subtitle}>Translation failed. Please try again or change your language settings.</Text>
      </View>
      <PrimaryButton title="Try Again" fullWidth onPress={() => router.back()} />
      <SecondaryButton title="Report a Problem" onPress={() => router.push('/settings')} />
    </ScreenShell>
  );
}

export function MobileTabsLayout() {
  return null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.colors.background },
  centeredSplash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background },
  brandLogo: { width: 300, height: 300, marginBottom: 16 },
  appName: { marginTop: 18, fontSize: 20, color: theme.colors.primaryText, fontWeight: '700', letterSpacing: 1 },
  tagline: { marginTop: 10, color: theme.colors.secondaryText, fontSize: 16 },
  title: { fontSize: 28, fontWeight: '700', color: theme.colors.primaryText },
  subtitle: { fontSize: 16, color: theme.colors.secondaryText, marginTop: 8 },
  primaryButton: { backgroundColor: theme.colors.emerald, paddingVertical: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  primaryButtonText: { color: '#082018', fontSize: 16, fontWeight: '700' },
  authButton: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', minHeight: 52, flexDirection: 'row', gap: 10 },
  authButtonDark: { backgroundColor: '#14231C', borderColor: '#14231C' },
  authButtonText: { color: theme.colors.primaryText, fontSize: 16, fontWeight: '700' },
  authButtonTextDark: { color: theme.colors.white },
  authInput: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, minHeight: 52, paddingHorizontal: 16, color: theme.colors.primaryText, fontSize: 16 },
  authError: { color: theme.colors.error, textAlign: 'center', fontSize: 13 },
  authLogo: { width: 180, height: 180, alignSelf: 'center', marginTop: 10, marginBottom: 12 },
  authForm: { gap: 12, marginTop: 22 },
  authLanguageRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  authLanguageLabel: { color: theme.colors.secondaryText, fontSize: 13 },
  languageSwitch: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, backgroundColor: theme.colors.elevated },
  languageSwitchText: { color: theme.colors.emeraldDark, fontWeight: '800' },
  stepLabel: { color: theme.colors.emeraldDark, fontWeight: '800', marginTop: 4 },
  fieldLabel: { color: theme.colors.primaryText, fontWeight: '700', marginTop: 4 },
  phoneRow: { flexDirection: 'row', gap: 8 },
  countryCode: { width: 76, minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center' },
  countryCodeText: { color: theme.colors.primaryText, fontWeight: '700' },
  phoneInput: { flex: 1 },
  languageChoiceList: { maxHeight: 220, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, paddingHorizontal: 10 },
  languageChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: theme.colors.border, paddingHorizontal: 6 },
  languageChoiceActive: { backgroundColor: '#E2F4EA', borderColor: theme.colors.emerald },
  languageFlag: { fontSize: 24 },
  selectInput: { minHeight: 52, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { color: theme.colors.primaryText, fontSize: 16 },
  selectPlaceholder: { color: theme.colors.secondaryText, fontSize: 16 },
  preferredRow: { minHeight: 52 },
  preferredChoice: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 10, marginRight: 8 },
  preferredText: { color: theme.colors.primaryText, fontWeight: '600' },
  secondaryButton: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 14, borderRadius: 18, alignItems: 'center', justifyContent: 'center', minHeight: 52 },
  secondaryButtonText: { color: theme.colors.primaryText, fontSize: 16, fontWeight: '600' },
  fullWidth: { width: '100%' },
  buttonStack: { gap: 12, marginTop: 26 },
  heroBlock: { marginTop: 48 },
  onboardingCard: { backgroundColor: theme.colors.surface, borderRadius: 24, padding: 28, borderWidth: 1, borderColor: theme.colors.border, marginTop: 36 },
  onboardingLogo: { width: 220, height: 220, alignSelf: 'center', marginBottom: 20 },
  onboardingTitle: { fontSize: 30, lineHeight: 38, color: theme.colors.primaryText, fontWeight: '700' },
  onboardingText: { marginTop: 10, fontSize: 16, color: theme.colors.secondaryText, lineHeight: 22 },
  dotsRow: { flexDirection: 'row', gap: 10, marginTop: 24 },
  dot: { width: 10, height: 10, borderRadius: 6, backgroundColor: '#334155' },
  dotActive: { backgroundColor: theme.colors.emerald, width: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, marginBottom: 18 },
  topBarTitle: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  topBarTitleText: { fontSize: 19, fontWeight: '700', color: theme.colors.primaryText },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  rightAction: { width: 40, alignItems: 'flex-end' },
  translateHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 },
  headerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  greeting: { color: theme.colors.secondaryText, fontSize: 14 },
  name: { color: theme.colors.primaryText, fontSize: 22, fontWeight: '700', marginTop: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center', color: '#08150F', fontWeight: '700' },
  avatarLarge: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center' },
  avatarLetter: { color: '#08150F', fontWeight: '700', fontSize: 28 },
  avatarLogo: { width: 54, height: 54 },
  profileScroll: { paddingBottom: 32 },
  profileLogo: { width: 160, height: 160, marginBottom: 6 },
  signOutRow: { marginTop: 8, borderColor: '#FECACA', backgroundColor: '#FFF7F7' },
  signOutText: { color: theme.colors.error, fontWeight: '700' },
  minuteBanner: { marginTop: 20, backgroundColor: theme.colors.surface, borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: theme.colors.border },
  minuteLabel: { color: theme.colors.primaryText, fontWeight: '600' },
  plusButton: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.emerald, justifyContent: 'center', alignItems: 'center' },
  langSelectorCard: { marginTop: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: theme.colors.surface, borderRadius: 22, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  languagePill: { flex: 1, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  languageValue: { color: theme.colors.primaryText, fontSize: 18, fontWeight: '600' },
  swapButton: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.elevated, alignItems: 'center', justifyContent: 'center', marginHorizontal: 10 },
  micWrap: { marginTop: 32, alignItems: 'center' },
  micButton: { width: 180, height: 180, borderRadius: 90, backgroundColor: theme.colors.emerald, justifyContent: 'center', alignItems: 'center', shadowColor: '#10B981', shadowOpacity: 0.35, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  tapText: { textAlign: 'center', color: theme.colors.primaryText, fontSize: 24, fontWeight: '700', marginTop: 18 },
  helperText: { textAlign: 'center', color: theme.colors.secondaryText, marginTop: 10 },
  rowBetween: { marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  smallCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border },
  detectedTag: { marginTop: 12, color: theme.colors.emerald, textAlign: 'center', fontWeight: '600' },
  searchBox: { marginVertical: 12, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchText: { color: theme.colors.secondaryText },
  sectionTitle: { fontSize: 16, color: theme.colors.primaryText, marginBottom: 12, fontWeight: '700' },
  languageRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: 'row', alignItems: 'center', gap: 10 },
  languageRowText: { color: theme.colors.primaryText, fontSize: 16 },
  languageNative: { color: theme.colors.secondaryText },
  textInput: { backgroundColor: theme.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, minHeight: 170, padding: 16, color: theme.colors.primaryText, fontSize: 18, textAlignVertical: 'top', marginBottom: 18 },
  resultCard: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: theme.colors.border, marginTop: 20 },
  resultLabel: { color: theme.colors.secondaryText, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginTop: 12 },
  resultText: { color: theme.colors.primaryText, fontSize: 18, marginTop: 6 },
  resultActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, gap: 10 },
  actionPill: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  actionLabel: { color: theme.colors.primaryText, fontWeight: '600' },
  label: { marginTop: 18, color: theme.colors.primaryText, fontSize: 15, fontWeight: '600' },
  selectorBox: { marginTop: 10, backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.colors.border },
  selectorValue: { color: theme.colors.primaryText, fontSize: 16 },
  voiceDirections: { flexDirection: 'row', gap: 12, marginTop: 26 },
  voiceDirection: { flex: 1, minHeight: 150, borderRadius: 20, backgroundColor: theme.colors.emerald, padding: 18, justifyContent: 'center', alignItems: 'center', gap: 7 },
  voiceDirectionSecondary: { backgroundColor: theme.colors.elevated, borderWidth: 1, borderColor: theme.colors.border },
  voiceDirectionLabel: { color: theme.colors.primaryText, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  voiceDirectionHint: { color: theme.colors.secondaryText, fontSize: 12, textAlign: 'center' },
  textLanguageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  textLanguageSelector: { flex: 1, minHeight: 54, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, backgroundColor: theme.colors.surface, justifyContent: 'center', paddingHorizontal: 12 },
  translationInputCard: { position: 'relative' },
  clearInput: { position: 'absolute', right: 12, bottom: 28 },
  translationOutputCard: { minHeight: 130, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 18, padding: 16, marginBottom: 14 },
  translationOutput: { color: theme.colors.primaryText, fontSize: 18, lineHeight: 25, marginTop: 8 },
  textActions: { alignItems: 'flex-end', gap: 8, marginBottom: 14 },
  verticalAction: { minWidth: 150, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
  roleCard: { backgroundColor: theme.colors.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, padding: 18, marginTop: 18, gap: 8 },
  roleTitle: { color: theme.colors.primaryText, fontSize: 20, fontWeight: '800' },
  roleText: { color: theme.colors.secondaryText, lineHeight: 20, marginBottom: 8 },
  connectInvite: { alignItems: 'center', gap: 14, paddingTop: 18 },
  pairingCode: { color: theme.colors.primaryText, fontSize: 28, fontWeight: '800', letterSpacing: 3 },
  sessionStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14, backgroundColor: '#FFF8E6' },
  sessionStatusReady: { backgroundColor: '#E2F4EA' },
  sessionStatusText: { color: theme.colors.primaryText, fontWeight: '600' },
  pairingInput: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 16, minHeight: 58, paddingHorizontal: 18, color: theme.colors.primaryText, fontSize: 22, letterSpacing: 3, textAlign: 'center', marginTop: 24 },
  scanner: { flex: 1 },
  participantRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  participantCard: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  participantName: { color: theme.colors.primaryText, fontWeight: '800', fontSize: 16 },
  participantLanguage: { color: theme.colors.secondaryText, marginTop: 6 },
  liveStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, alignSelf: 'center' },
  statusDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.colors.warning },
  statusDotLive: { backgroundColor: theme.colors.emerald },
  liveStatusText: { color: theme.colors.secondaryText, fontWeight: '600' },
  timelineCard: { marginTop: 16, backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  emptyTimeline: { marginTop: 22, minHeight: 180, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.colors.border, padding: 24 },
  emptyText: { color: theme.colors.secondaryText, textAlign: 'center', marginTop: 12, lineHeight: 20 },
  messageHeader: { color: theme.colors.secondaryText },
  messageText: { color: theme.colors.primaryText, marginTop: 4, fontSize: 16 },
  messageTranslation: { color: theme.colors.emerald, marginTop: 8, fontSize: 16 },
  timeStamp: { marginTop: 8, color: theme.colors.secondaryText, fontSize: 12 },
  bottomControls: { marginTop: 22, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  controlChip: { flex: 1, backgroundColor: theme.colors.surface, borderRadius: 18, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border },
  controlChipActive: { backgroundColor: theme.colors.elevated, borderColor: theme.colors.emerald },
  controlChipEnd: { flex: 1, backgroundColor: theme.colors.error, borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  remainingText: { marginTop: 16, color: theme.colors.secondaryText, textAlign: 'center' },
  completionCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 20, borderWidth: 1, borderColor: theme.colors.border, marginTop: 30 },
  filterRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  filterPill: { backgroundColor: theme.colors.surface, borderRadius: 999, borderWidth: 1, borderColor: theme.colors.border, paddingHorizontal: 14, paddingVertical: 8 },
  filterPillActive: { backgroundColor: theme.colors.emerald, borderColor: theme.colors.emerald },
  filterText: { color: theme.colors.primaryText },
  filterTextActive: { color: '#08150F', fontWeight: '700' },
  historyCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  historyLanguage: { color: theme.colors.primaryText, fontWeight: '700', fontSize: 16 },
  historyPreview: { color: theme.colors.secondaryText, marginTop: 6 },
  historyMeta: { color: theme.colors.secondaryText, marginTop: 10, fontSize: 12 },
  profileHeader: { marginTop: 28, alignItems: 'center' },
  planTag: { marginTop: 10, color: theme.colors.emeraldDark, fontWeight: '700', backgroundColor: theme.colors.elevated, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  settingsList: { marginTop: 18, gap: 10 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  settingsText: { color: theme.colors.primaryText, fontSize: 16 },
  settingValue: { color: theme.colors.emerald, fontSize: 14, fontWeight: '700' },
  usageCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, marginTop: 16, borderWidth: 1, borderColor: theme.colors.border },
  usageLabel: { color: theme.colors.primaryText, fontWeight: '600' },
  usageValue: { color: theme.colors.secondaryText, marginTop: 8 },
  progressBar: { marginTop: 12, height: 8, backgroundColor: theme.colors.elevated, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: theme.colors.emerald, borderRadius: 999 },
  planCard: { backgroundColor: theme.colors.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 18 },
  planPopular: { borderColor: theme.colors.emerald, shadowColor: theme.colors.emerald, shadowOpacity: 0.2, shadowRadius: 12 },
  badge: { alignSelf: 'flex-start', backgroundColor: theme.colors.elevated, color: theme.colors.emeraldDark, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontSize: 10, marginBottom: 10, fontWeight: '700' },
  planName: { color: theme.colors.primaryText, fontSize: 26, fontWeight: '800' },
  planPrice: { color: theme.colors.primaryText, fontSize: 28, fontWeight: '800', marginTop: 6 },
  planPeriod: { fontSize: 14, color: theme.colors.secondaryText, fontWeight: '500' },
  planMeta: { color: theme.colors.secondaryText, marginTop: 4 },
  featureText: { color: theme.colors.primaryText, marginTop: 8 },
  checkoutCard: { backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, marginTop: 18, borderWidth: 1, borderColor: theme.colors.border },
  checkoutTitle: { color: theme.colors.primaryText, fontSize: 28, fontWeight: '700' },
  checkoutPrice: { color: theme.colors.secondaryText, marginTop: 10 },
  checkoutText: { color: theme.colors.primaryText, marginTop: 8 },
  successCard: { marginTop: 30, alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.colors.border },
  permissionCard: { marginTop: 40, alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  errorCard: { marginTop: 40, alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 18, padding: 18, borderWidth: 1, borderColor: theme.colors.border },
  countryOption: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.25)' },
  countryModal: { maxHeight: '85%', backgroundColor: theme.colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 12 },
  confirmationCard: { marginTop: 90, alignItems: 'center', backgroundColor: theme.colors.surface, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, padding: 24 },
});

export function formatPrice(value: number) {
  return `$${value.toFixed(2)}`;
}
