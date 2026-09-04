import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { aiConfig, corsHeaders, jsonResponse, openRouterHeaders } from '../_shared/ai.ts';

serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);
    const { text, language } = await request.json();
      const apiKey = Deno.env.get('OPENROUTER_API_KEY');
    if (!apiKey) return jsonResponse({ error: 'Speech provider is not configured' }, 503);
    if (typeof text !== 'string' || !text.trim() || typeof language !== 'string') return jsonResponse({ error: 'Text and language are required' }, 400);
    const requestBody = { model: aiConfig.ttsModel, input: text, instructions: `Speak naturally in ${language}.`, response_format: 'mp3' };
    let response = await fetch(`${aiConfig.baseUrl}/audio/speech`, { method: 'POST', headers: openRouterHeaders(apiKey), body: JSON.stringify(requestBody) });
    if (!response.ok) response = await fetch(`${aiConfig.baseUrl}/audio/speech`, { method: 'POST', headers: openRouterHeaders(apiKey), body: JSON.stringify({ ...requestBody, model: aiConfig.ttsFallbackModel }) });
    if (!response.ok) return jsonResponse({ error: 'Speech provider failed' }, 502);
    const bytes = new Uint8Array(await response.arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]);
    return jsonResponse({ audioUrl: `data:audio/mpeg;base64,${btoa(binary)}` });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: 'Unable to synthesize speech right now' }, 500);
  }
});
