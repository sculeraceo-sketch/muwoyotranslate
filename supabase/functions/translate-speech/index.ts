import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiConfig, corsHeaders, jsonResponse, openRouterHeaders } from '../_shared/ai.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { audioBase64, sourceLanguage, targetLanguage, autoDetect } = await request.json();
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Speech provider is not configured' }, 503);
    if (typeof audioBase64 !== 'string' || !audioBase64 || typeof targetLanguage !== 'string') return jsonResponse({ error: 'Invalid speech request' }, 400);
    const bytes = Uint8Array.from(atob(audioBase64), (character) => character.charCodeAt(0));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/m4a' }), 'recording.m4a');
    form.append('model', aiConfig.sttModel);
    const transcriptionResponse = await fetch(`${aiConfig.baseUrl}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!transcriptionResponse.ok) return jsonResponse({ error: 'Speech provider failed' }, 502);
    const transcription = await transcriptionResponse.json();
    const text = typeof transcription.text === 'string' ? transcription.text.trim() : '';
    if (!text) return jsonResponse({ error: 'No speech detected' }, 422);
    const translationResponse = await fetch(`${aiConfig.baseUrl}/chat/completions`, { method: 'POST', headers: openRouterHeaders(apiKey), body: JSON.stringify({ model: aiConfig.translationModel, temperature: 0, messages: [{ role: 'system', content: 'You are a professional real-time translation engine. Return only translated content. Do not explain, answer, summarize, or add notes. Preserve meaning, names, numbers, tone, and intent.' }, { role: 'user', content: `Source language: ${autoDetect ? 'detect automatically' : sourceLanguage}\nTarget language: ${targetLanguage}\nText: ${text}` }] }) });
    if (!translationResponse.ok) return jsonResponse({ error: 'Translation provider failed' }, 502);
    const payload = await translationResponse.json();
    const translatedText = payload.choices?.[0]?.message?.content?.trim();
    if (!translatedText) return jsonResponse({ error: 'Translation provider returned no result' }, 502);
    return jsonResponse({ originalText: text, translatedText, detectedLanguage: transcription.language });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: 'Unable to translate speech right now' }, 500);
  }
});
