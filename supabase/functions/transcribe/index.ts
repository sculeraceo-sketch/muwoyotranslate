import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiConfig, corsHeaders, jsonResponse } from '../_shared/ai.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { audioBase64, language } = await request.json();
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Speech provider is not configured' }, 503);
    if (typeof audioBase64 !== 'string' || !audioBase64) return jsonResponse({ error: 'Audio is required' }, 400);
    const bytes = Uint8Array.from(atob(audioBase64), (character) => character.charCodeAt(0));
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: 'audio/m4a' }), 'recording.m4a');
    form.append('model', aiConfig.sttModel);
    if (typeof language === 'string' && language.length === 2) form.append('language', language);
    const response = await fetch(`${aiConfig.baseUrl}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!response.ok) return jsonResponse({ error: 'Speech provider failed' }, 502);
    const payload = await response.json();
    return jsonResponse({ text: payload.text ?? '', detectedLanguage: payload.language });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: 'Unable to transcribe right now' }, 500);
  }
});
