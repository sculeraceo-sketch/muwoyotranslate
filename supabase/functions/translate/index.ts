import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { text, sourceLanguage, targetLanguage, autoDetect } = await request.json();
    if (typeof text !== 'string' || !text.trim() || typeof targetLanguage !== 'string') return new Response(JSON.stringify({ error: 'Invalid translation request' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) return new Response(JSON.stringify({ error: 'Translation provider is not configured' }), { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const providerResponse = await fetch(Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': Deno.env.get('APP_URL') ?? 'https://muwoyo.app', 'X-Title': 'Muwoyo Translate' },
      body: JSON.stringify({ model: Deno.env.get('OPENROUTER_TRANSLATION_MODEL') ?? 'openai/gpt-4o-mini', temperature: 0, messages: [{ role: 'system', content: 'You are a translation engine. Return only the translated text. Preserve meaning and formatting.' }, { role: 'user', content: `Source language: ${autoDetect ? 'detect automatically' : sourceLanguage}\nTarget language: ${targetLanguage}\nText: ${text}` }] }),
    });
    if (!providerResponse.ok) return new Response(JSON.stringify({ error: 'Translation provider failed' }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    const payload = await providerResponse.json();
    const translatedText = payload.choices?.[0]?.message?.content?.trim();
    if (!translatedText) throw new Error('Provider returned no translation');
    return new Response(JSON.stringify({ originalText: text, translatedText, detectedLanguage: autoDetect ? sourceLanguage : undefined }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: 'Unable to translate right now' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
