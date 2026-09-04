export const aiConfig = {
  baseUrl: Deno.env.get('OPENROUTER_BASE_URL') ?? 'https://openrouter.ai/api/v1',
  translationModel: Deno.env.get('OPENROUTER_TRANSLATION_MODEL') ?? 'google/gemini-2.5-flash-lite',
  sttModel: Deno.env.get('OPENROUTER_STT_MODEL') ?? 'openai/gpt-4o-mini-transcribe',
  ttsModel: Deno.env.get('OPENROUTER_TTS_MODEL') ?? 'google/gemini-3.1-flash-tts-preview',
  ttsFallbackModel: Deno.env.get('OPENROUTER_TTS_FALLBACK_MODEL') ?? 'qwen/qwen-audio-3.0-tts-flash',
};

export function openRouterHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': Deno.env.get('APP_URL') ?? 'https://muwoyo.app',
    'X-Title': 'Muwoyo Translate',
  };
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
  });
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
