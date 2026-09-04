import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiConfig, corsHeaders, jsonResponse, openRouterHeaders } from '../_shared/ai.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { text, sourceLanguage, targetLanguage, autoDetect } = await request.json();
    if (typeof text !== 'string' || !text.trim() || typeof targetLanguage !== 'string') return jsonResponse({ error: 'Invalid translation request' }, 400);
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Translation provider is not configured' }, 503);

    const providerResponse = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: openRouterHeaders(apiKey),
      body: JSON.stringify({ model: aiConfig.translationModel, temperature: 0, messages: [{ role: 'system', content: 'You are a professional real-time translation engine. Return only translated content. Do not explain, answer, summarize, or add notes. Preserve meaning, names, numbers, tone, and intent.' }, { role: 'user', content: `Source language: ${autoDetect ? 'detect automatically' : sourceLanguage}\nTarget language: ${targetLanguage}\nText: ${text}` }] }),
    });
    if (!providerResponse.ok) return jsonResponse({ error: 'Translation provider failed' }, 502);
    const payload = await providerResponse.json();
    const translatedText = payload.choices?.[0]?.message?.content?.trim();
    if (!translatedText) throw new Error('Provider returned no translation');
    return jsonResponse({ originalText: text, translatedText, detectedLanguage: autoDetect ? sourceLanguage : undefined });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: 'Unable to translate right now' }, 500);
  }
});
